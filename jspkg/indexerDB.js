function indexerDB(opts){
    if(!opts){opts={};}
	//modules
	this.utils=require('../jspkg/utils');
	this._ = require('underscore');
	this.merge=require('merge');
	this.md5=require('MD5');
	this.url=require('url');
	
	//variables/settings
	this.mysql_obj=opts.mysql;
    this.sql_default={'limit':{'row_count':10}}
	this.version_obj=(typeof(opts.version_obj)=='object'?opts.version_obj:{'id':false,'settings':false});
	/*this.table_schema={
		'url_sources':{
			'response_code':function(){}//return true/false (as a base validation) or a forced value
		},
		'selector_content_index':{
			'url_source_id':function(){}//return true/false (as a base validation) or a forced value
		}
	};*/
	this.table_keys={
		'url_sources':['id', 'version_id', 'response_code', 'url', 'url_ident', 'referer_header', 'referer_stamp', 
						'viewport_x', 'viewport_y', 'viewport_density', 'user_agent', 'cache_file', 'content_md5', 
                        'cookie_vars','get_vars','cookie_vars','post_vars',
						'method', 'date_event', 'date_created', 'date_crawled', 'date_modified'],
		'selector_content_index':['url_source_id', 'css_selector_id', 'computed_style_json', 'applied_style_json', 'generic_selector', 
									'specific_selector', 'diff_selector', 'inner_html_md5']
	};
	this.response_codes={
        '000':{'code':'000'},//custom
        '200':{'code':'200'},
        '300':{'code':'300', 'title':'Multiple Choices'},
        '301':{'code':'301', 'title':'Moved Permanently', 'is_redirect':true},
        '302':{'code':'302', 'title':'Found'/*, 'is_redirect':true*/},//this should fix the issue where the browser redirects to the 'curr/URI/REWRITE' to 'curr/URI/REWRITE/' ?!?
        '303':{'code':'303', 'title':'See Other (since HTTP/1.1)', 'is_redirect':true},
        '304':{'code':'304', 'title':'Not Modified (RFC 7232)'},
        '305':{'code':'305', 'title':'Use Proxy (since HTTP/1.1)'},
        '306':{'code':'306', 'title':'Switch Proxy'},
        '307':{'code':'307', 'title':'Temporary Redirect (since HTTP/1.1)', 'is_redirect':true},
        '400': {'code':'400'},
        '402': {'code':'402'},
        '403': {'code':'403'},
        '404': {'code':'404'},
        '405': {'code':'405'},
        '406': {'code':'406'},
        '407': {'code':'407'},
        '408': {'code':'408'},
        '409': {'code':'409'},
        '410': {'code':'410'},
        '411': {'code':'411'},
        '412': {'code':'412'},
        '413': {'code':'413'},
        '414': {'code':'414'},
        '415': {'code':'415'},
        '416': {'code':'416'},
        '417': {'code':'417'},
        '418': {'code':'418'},
        '419': {'code':'419'},
        '420': {'code':'420'},
        '421': {'code':'421'},
        '422': {'code':'422'},
        '423': {'code':'423'},
        '424': {'code':'424'},
        '426': {'code':'426'},
        '428': {'code':'428'},
        '429': {'code':'429'},
        '431': {'code':'431'},
        '440': {'code':'440'},
        '444': {'code':'444'},
        '449': {'code':'449'},
        '450': {'code':'450'},
        '451': {'code':'451'},
        '494': {'code':'494'},
        '495': {'code':'495'},
        '496': {'code':'496'},
        '497': {'code':'497'},
        '498': {'code':'498'},
        '499': {'code':'499'},
        '9999': {'code':'9999'}
    };
    this.response_codes['null']=this.response_codes['000'];
    this.response_codes['skip']=this.response_codes['9999'];
	this.init();//start!
}
indexerDB.prototype.init=function(){
	var self=this;
	if(self.version_obj!==false && self.version_obj.id!==false && self.version_obj.settings!==false){self.init_instance(self.version_obj);}
	else{self.init_instance();}
};
indexerDB.prototype.terminate=function(){
	var self=this;
};
indexerDB.prototype.apply_callback=function(res, callbacks, next, debugVar){// { 'end':function(){},'result':function(row){},'fields':function(fields){},'error':function(err){} }
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++=====apply_callback===++++++++++++++++++\n++++++++++++++++++\n\n\n\n");
	var self=this,
        args=[],
		bool_next=false,
		do_next=function(){
//console.log('NEXT CHECK ',typeof(next),' && ',bool_next);
			if(typeof(next)==='function' && bool_next===false){
				if(arguments.length>0){
					for(var i=0;i<arguments.length;i++){args.push(arguments[i]);};}
				bool_next=true;//WORRIED ABOUT RACE CONDITION
				next.apply(self,args);
			}
		};
	if(typeof(res)!=='object'){return false;}//no data
	if(typeof(callbacks)==='function'){callbacks={'callback':callbacks};}//if passed lazily
	if(typeof(next)==='function'){for(var i=0;i<arguments.length;i++){if(i!==2){/* ignore next */args.push(arguments[i]);}};}
    
    for(var k in callbacks){//callback system within 
        if(k==='callback'){continue;}
        if(self.utils.obj_valid_key(callbacks,k) && !self.utils.obj_valid_key(callbacks,'on'+k)){
            if(k.toLowerCase().indexOf('on')!==0){//doesn't start with 'on'?!
                callbacks['on'+k]=callbacks[k];
            }
        }
    }
	
	res.on('error', function(err) {
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++      error      ++++++++++++++++++\n++++++++++++++++++\n\n\n\n");
		// Handle error, an 'end' event will be emitted after this as well
		if(typeof(callbacks)=='object' && (typeof(callbacks.onerror)==='function' || typeof(callbacks.callback)==='function')){
			if(typeof(callbacks.onerror)==='function'){
				callbacks.onerror.apply(self,[res,err,debugVar]);
			}
			 if(typeof(callbacks.callback)==='function'){                
				callbacks.callback.apply(self,['error',res,err,debugVar]);
			}
		}
		do_next(err);
	})
	.on('fields', function(fields) {
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++      fields      ++++++++++++++++++\n++++++++++++++++++\n\n\n\n");
		// the field packets for the rows to follow
		if(typeof(callbacks)=='object' && (typeof(callbacks.onfields)==='function' || typeof(callbacks.callback)==='function')){
			if(typeof(callbacks.onfields)==='function'){
				callbacks.onfields.apply(self,[res,fields,debugVar]);
			}
			 if(typeof(callbacks.callback)==='function'){
				callbacks.callback.apply(self,['fields',res,fields,debugVar]);
			}
		}
		do_next(fields);
//        var the_args=[fields];
//        for(var a=0;a<arguments.length;a++){the_args.push(arguments[a]);}
//        do_next.apply(self,the_args);
	})
	.on('result', function(row) {
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++      result      ++++++++++++++++++\n++++++++++++++++++\n\n\n\n");
/*
		// Pausing the connnection is useful if your processing involves I/O
		self.mysql_obj.pause();

		processRow(row, function() {
			self.mysql_obj.resume();
		});
		*/
		if(typeof(callbacks)=='object' && (typeof(callbacks.onresult)==='function' || typeof(callbacks.callback)==='function')){
			if(typeof(callbacks.onresult)==='function'){
				callbacks.onresult.apply(self,[res,row,debugVar]);
			}
			 if(typeof(callbacks.callback)==='function'){                
				callbacks.callback.apply(self,['result',res,row,debugVar]);
			}
		}
		do_next(row);
	})
	.on('end', function() {
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++      end      ++++++++++++++++++\n++++++++++++++++++\n\n\n\n");
		// all rows have been received
		if(typeof(callbacks)=='object' && (typeof(callbacks.onend)==='function' || typeof(callbacks.callback)==='function')){
			if(typeof(callbacks.onend)==='function'){
				callbacks.onend.apply(self,[res,debugVar]);
			}
			 if(typeof(callbacks.callback)==='function'){                
				callbacks.callback.apply(self,['end',res,debugVar]);
			}
		}
		do_next();
	});		
};

indexerDB.prototype.init_instance=function(dataObj){
	var self=this;
	if(arguments.length==0){//if function has no argument: was used as ->  [[ object ]].init_instance( );
		//make new
	}else{
		//retrieve
	}
};

indexerDB.prototype.api_view_instance=function(callbacks, doDebug){
    var self=this;
	if(typeof(callbacks)==='function'){callbacks={'callback':callbacks};}//if passed lazily
    var apisql="SELECT "+
        "valid_resp.valid_count AS progress_inc, "+
        "all_data.row_count AS progress_max, "+
        "CONCAT(valid_resp.valid_count,' / ',all_data.row_count) AS progress_str, "+
        "(valid_resp.valid_count/all_data.row_count) AS percent_dbl, "+
        "CONCAT((valid_resp.valid_count/all_data.row_count*100),'%') AS percent_str, "+
        "valid_200_resp.valid_200_count AS valid_200_count, "+
        "valid_200_resp.max_200_valid AS max_200_valid, "+
        "valid_resp.valid_count AS ratio_resp, "+ // something found responded
        "non_valid_resp.non_valid_count AS ratio_non_resp, "+ //things unresponded (no response code yet)
        "UNIX_TIMESTAMP(NOW())-UNIX_TIMESTAMP(valid_resp.max_crawl_date) AS last_modified_diff, "+
        "valid_resp.max_crawl_date AS last_modified "+
        "FROM ("+
            "SELECT "+
            "COUNT(*) AS valid_count, "+
            "MAX(date_crawled) AS max_crawl_date, "+
            "MAX(id) AS max_valid "+
            "FROM url_sources "+
            "WHERE "+
            "response_code!='000'"+
            ") AS valid_resp, "+
        "("+
            "SELECT "+
            "COUNT(*) AS non_valid_count, "+
            "MIN(id) AS min_non_valid "+
            "FROM url_sources "+
            "WHERE "+
            "response_code='000'"+
        ") AS non_valid_resp, "+
        "("+
            "SELECT "+
            "COUNT(*) AS valid_200_count, "+
            "MAX(id) AS max_200_valid "+
            "FROM url_sources "+
            "WHERE "+
            "response_code='"+self.response_codes['200'].code+"'"+
        ") AS valid_200_resp, "+
        "("+
            "SELECT "+
            "COUNT(*) AS row_count "+
            "FROM url_sources "+
        ") AS all_data;",
    result=self.mysql_obj.query(apisql);
if(doDebug){console.log('===================================',"\n\t",'SQL: ',apisql,"\n");}
	self.apply_callback(result,callbacks,function(res,cbs,arg){//res,cbs,arg - arguments supplied from apply_callback()
        for(var _args=[],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.last)==='function'){callbacks.last.apply(self,_args);}//callbacks.last(this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
        for(var _args=['last'],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.callback)==='function'){callbacks.callback.apply(self,_args);}//callbacks.callback('last',this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
	});
};
indexerDB.prototype.view_instance=function(dataObj,callbacks, doDebug){
    var self=this;
//console.log('dataObj',dataObj);
	if(typeof(dataObj)!=='object'){return false;}//no data
	if(typeof(callbacks)==='function'){callbacks={'callback':callbacks};}//if passed lazily
    var sql_select='SELECT ',
        count=0,
        w_count=0,
        select_cols=[];
    for(var c=0;c<self.table_keys.url_sources.length;c++){
        var key=self.table_keys.url_sources[c];
        if(self.utils.obj_valid_key(dataObj,key)){
            if(count!=0){sql_select=sql_select+', ';}
            sql_select=sql_select+'`url_sources`.'+ key +' AS '+key;
            select_cols.push(key);
            count++;
        }else if(self.utils.obj_valid_key(self.version_obj,key)){
            if(count!=0){sql_select=sql_select+', ';}
            sql_select=sql_select+'`url_sources`.'+ key +' AS '+key;
            select_cols.push(key);
            count++;            
        }
    }
    if(count===0){return false;}
    //count=0;//reuse - do not reset!
    
    
    var base_keys=['id', 'version_id', 'response_code', 'url', 'cache_file', 'content_md5', 'get_vars','post_vars','method', 
        'date_created', 'date_crawled', 'date_modified'],
        sql_from='FROM `url_sources` ',
        sql_where='';

    for(var c=0;c<self.table_keys.url_sources.length;c++){
        var key=self.table_keys.url_sources[c];
        if(self._.indexOf(base_keys,key)!==-1 && self._.indexOf(select_cols,key)===-1){//if base key and unused
            if(count!=0){sql_select=sql_select+', ';}
            sql_select=sql_select+'`url_sources`.'+ key +' AS '+key;
            select_cols.push(key);
        }
        if(self.utils.obj_valid_key(dataObj,key) && self._.indexOf(self.table_keys.url_sources,key)!==-1){
            if(typeof(dataObj[key])==='string' || typeof(dataObj[key])==='number'){
                if(w_count!=0){sql_where=sql_where+'AND ';}
                sql_where=sql_where+'`url_sources`.'+key+' = '+ self.mysql_obj.escape(dataObj[key]) +' ';
                w_count++;
            }else if(key==='version_id' && self.utils.obj_valid_key(self.version_obj,'id')){
                if(w_count!=0){sql_where=sql_where+'AND ';}
                sql_where=sql_where+'`url_sources`.'+key+' = '+ self.mysql_obj.escape(self.version_obj[key]) +' ';
                w_count++;
            }else if(typeof(dataObj[key])==='object' && dataObj[key] instanceof Array && dataObj[key].length>0){
                if(w_count!=0){sql_where=sql_where+'AND ';}
                sql_where=sql_where+'(';
                for(var i=0;i<dataObj[key].length;i++){
                    if(typeof(dataObj[key][i])==='string' || typeof(dataObj[key][i])==='number'){
                        if(i!=0){sql_where=sql_where+' OR ';}
                        sql_where=sql_where+'`url_sources`.'+key+' = '+ self.mysql_obj.escape(dataObj[key][i]);
                    }
                }
                sql_where=sql_where+') ';
                w_count++;
            }else if(dataObj[key]===null){
                w_count++;
                continue;
            }
        }
    }
    if(w_count===0 || count===0){
console.log('====== cont ZERO: w_count: '+w_count+'  count: '+count+'  =======');
        return false;}

    var row_count=(self.utils.obj_valid_key(dataObj,'limit') && typeof(dataObj.limit)==='object' && self.utils.obj_valid_key(dataObj.limit,'row_count')?dataObj.limit.row_count:self.sql_default.limit.row_count),
        sql_limit=(self.utils.obj_valid_key(dataObj,'limit') && typeof(dataObj.limit)==='object'?'LIMIT ' + dataObj.limit.pos + ', ' + dataObj.limit.row_count:''),
        sql_order_by=(self.utils.obj_valid_key(dataObj,'order_by')?'ORDER BY '+dataObj.order_by:'');// && self._.indexOf(self.table_keys.url_sources, dataObj.order_by)!==-1 //self.utils.check_strip_last(self.utils.check_strip_last(dataObj.order_by,' DESC'),' ASC')
    sql_order_by=(self.utils.obj_valid_key(dataObj,'group_by')?'GROUP BY '+dataObj.group_by + ' ' + sql_order_by:sql_order_by);// && self._.indexOf(self.table_keys.url_sources, dataObj.group_by)!==-1
    sql_limit=(self.utils.basic_str(sql_limit)?sql_limit:'LIMIT '+row_count);
    
	var sql_full=sql_select + ' ' + sql_from + (self.utils.basic_str(sql_where)?'WHERE '+ sql_where:'') + sql_order_by + (self.utils.basic_str(sql_limit)?' ' + sql_limit:'') + ';',
        result=self.mysql_obj.query(sql_full);
if(doDebug){console.log('===================================',"\n\t",'SQL: ',sql_full,"\n");}
	self.apply_callback(result,callbacks,function(res,cbs,arg){//res,cbs,arg - arguments supplied from apply_callback()
        for(var _args=[],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.last)==='function'){callbacks.last.apply(self,_args);}//callbacks.last(this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
        for(var _args=['last'],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.callback)==='function'){callbacks.callback.apply(self,_args);}//callbacks.callback('last',this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
	});
};
indexerDB.prototype.valid_write_view_instance=function(dataObj,errArr,doDebug){
    var self=this,
        valid_keys={//minimum requirements
			'version_id':undefined,
			'response_code':undefined,
			'url':undefined,
			'url_ident':undefined,
			'referer_header':undefined,//can be empty string -> ''
			'referer_stamp':undefined,
			'user_agent':undefined,//can be empty string -> ''
			//'cache_file':undefined,
			//'content_md5':undefined,
			'method':undefined
        };
    if(self.utils.obj_valid_key(dataObj,'id')){
        valid_keys=self.merge(true, {}, valid_keys, {'id':undefined});
    }
    var valid_key_count=0,
		valid_key_max=self.utils.array_keys(valid_keys).length;//count 'valid_keys'
	//cleaning up and processing values
    if(self.utils.obj_valid_key(valid_keys,'id')){
        if(parseInt(dataObj.id)>0 && !isNaN(parseInt(dataObj.id))){
            valid_key_count++;
            valid_keys.id=parseInt(dataObj.id);
        }else{
            errArr.push('id');}
    }
	if(self.utils.obj_valid_key(dataObj,'version_id') && parseInt(dataObj.version_id)>0 && !isNaN(parseInt(dataObj.version_id))){
		valid_key_count++;
		valid_keys.version_id=parseInt(dataObj.version_id);
    }else if(self.utils.obj_valid_key(self.version_obj,'id') && parseInt(self.version_obj.id)>0 && !isNaN(parseInt(self.version_obj.id))){//false is parseInt as NaN
		valid_key_count++;
		valid_keys.version_id=parseInt(self.version_obj.id);
    }else{
        errArr.push('version_id');
    }
	if(self.utils.obj_valid_key(dataObj,'response_code') && self.utils.basic_str(dataObj.response_code)){
		valid_key_count++;
		valid_keys.response_code=(typeof(dataObj.response_code)==='string'?dataObj.response_code:dataObj.response_code.toString());}
    else{
		valid_key_count++;
        valid_keys.response_code=self.response_codes['null'].code;}
	if(self.utils.obj_valid_key(dataObj,'url') && self.utils.basic_str(dataObj.url)){
		valid_key_count++;
		valid_keys.url=(typeof(dataObj.url)==='string'?dataObj.url:dataObj.url.toString());

		if(self.utils.obj_valid_key(dataObj,'url_ident') && self.utils.basic_str(dataObj.url_ident)){
			valid_key_count++;
			valid_keys.url_ident=(typeof(dataObj.url_ident)==='string'?dataObj.url_ident:dataObj.url_ident.toString());
		}else{
			valid_key_count++;
			valid_keys=self.merge(true,{},valid_keys,{'url_ident':'.'});
		}
//		var tmp_url=self.url.parse((valid_keys.url_ident.substr(0,2)==='//'?'http://'+valid_keys.url_ident:valid_keys.url_ident));
//console.log('==== UNTESTED ===== ');
//console.log('========= tmp_url(from: '+(valid_keys.url_ident.substr(0,2)==='//'?'http://'+valid_keys.url_ident:valid_keys.url_ident)+') ',tmp_url);
//console.log('==== UNTESTED ===== ');
		valid_keys.url_ident=self.utils.url_chomp(valid_keys.url_ident);
    }else{
        errArr.push('url');
	}
	if(self.utils.obj_valid_key(dataObj,'referer_header') && (self.utils.basic_str(dataObj.referer_header) || dataObj.referer_header==='')){
		valid_key_count++;
		valid_keys.referer_header=(typeof(dataObj.referer_header)==='string'?dataObj.referer_header:dataObj.referer_header.toString());

		if(self.utils.obj_valid_key(dataObj,'referer_stamp') && self.utils.basic_str(dataObj.referer_stamp)){
			valid_key_count++;
			valid_keys.referer_stamp=(typeof(dataObj.referer_stamp)==='string'?dataObj.referer_stamp:dataObj.referer_stamp.toString());
		}else{
			valid_key_count++;
			valid_keys=self.merge(true,{},valid_keys,{'referer_stamp':self.md5(valid_keys.referer_header)});
		}
    }else{
        errArr.push('referer_header');
	}/*
	if(self.utils.obj_valid_key(dataObj,'cache_file') && self.utils.basic_str(dataObj.cache_file)){
		valid_key_count++;
		valid_keys.cache_file=(typeof(dataObj.cache_file)==='string'?dataObj.cache_file:dataObj.cache_file.toString());}
	if(self.utils.obj_valid_key(dataObj,'content_md5') && self.utils.basic_str(dataObj.content_md5)){
		valid_key_count++;
		valid_keys.content_md5=(typeof(dataObj.content_md5)==='string'?dataObj.content_md5:dataObj.content_md5.toString());}*/

	if(self.utils.obj_valid_key(dataObj,'user_agent') && (self.utils.basic_str(dataObj.user_agent) || dataObj.user_agent==='')){
		valid_key_count++;
		valid_keys.user_agent=(typeof(dataObj.user_agent)==='string'?dataObj.user_agent:dataObj.user_agent.toString());
    }else{
        errArr.push('user_agent');}
	if(self.utils.obj_valid_key(dataObj,'method') && self.utils.basic_str(dataObj.method)){
		valid_key_count++;
		valid_keys.method=(typeof(dataObj.method)==='string'?dataObj.method:dataObj.method.toString());
    }else{
        errArr.push('method');}
	
	if(!(valid_key_count>=valid_key_max)){//no validation keys found (white list)
		return false;}

	if(self.utils.obj_valid_key(dataObj,'cookie_vars')){
        if(self.utils.basic_str(dataObj.cookie_vars)){
            valid_keys.cookie_vars=dataObj.cookie_vars;}
        else{delete dataObj.cookie_vars;}
    }

	
	//transfer the values here so it doesn't get 'passed up' (pass by reference) accidentally
	for(var k in valid_keys){
		if(self.utils.obj_valid_key(valid_keys,k)){//valid object key (non-prototype)
			if(typeof(valid_keys[k])==='undefined'){continue;}
			dataObj[k]=valid_keys[k];//cleaned up
		}
	}
	// \\cleaning up and processing values
    return {'valid_key_count':valid_key_count, 'valid_keys':valid_keys, 'valid_key_max':valid_key_max};
	
};
indexerDB.prototype.add_view_instance=function(dataObj,callbacks,errArr,doDebug){
	var self=this,
		sql_insert='INSERT INTO `url_sources`(',
		sql_insert_vals=') VALUES (',
		sql_insert_end=');',
        sql_insert_safe='INSERT INTO `url_sources` SET ?',
		found=0;
	if(typeof(dataObj)!=='object'){return false;}//no data
	if(typeof(callbacks)==='function'){callbacks={'callback':callbacks};}//if passed lazily

    var valid_res=self.valid_write_view_instance(dataObj,errArr,doDebug);
    if(valid_res===false){return false;}

    var has_modified=false,
        has_event=false;
	for(var k in dataObj){
		if(self.utils.obj_valid_key(dataObj,k)){//valid object key (non-prototype)
//if(k==='cookie_vars'){if(doDebug){console.log("K: ",k);}}
			if(self._.indexOf(self.table_keys.url_sources,k)!==-1){//valid db table column name
//if(k==='cookie_vars'){if(doDebug){console.log("\tK: ",k, dataObj[k]);}}
                var sql_val=dataObj[k];
                has_modified=(k.toLowerCase()==='date_modified'?true:has_modified);
                has_event=(k.toLowerCase()==='date_event'?true:has_event);
                if(k.indexOf('date_')===0 && sql_val==='CURRENT_TIMESTAMP' && !self.mysql_55_hack(k,sql_val)){//5.6 likes current timestamp
                    sql_val=sql_val;}
                else if(k.indexOf('date_')===0 && sql_val==='CURRENT_TIMESTAMP' && self.mysql_55_hack(k,sql_val)){//5.5 likes NOW()
                    sql_val='NOW()';}
                else{
                    sql_val=self.mysql_obj.escape(dataObj[k]);}
				sql_insert=sql_insert+'`'+k+'`,';
				sql_insert_vals=sql_insert_vals + sql_val+',';
				found++;
			}
		}
	}
    
    if(found>0 && !has_modified && self.mysql_55_hack('date_modified','CURRENT_TIMESTAMP')){//5.5 doesn'ts auto-update
        sql_insert=sql_insert+'`date_modified`,';
        sql_insert_vals=sql_insert_vals + 'NOW(),';
    }
    if(found>0 && !has_event && self.mysql_55_hack('date_event','CURRENT_TIMESTAMP')){//5.5 doesn'ts auto-update
console.log('add_view_instance dataObj.url - has_event is true: ',dataObj.url);
        sql_insert=sql_insert+'`date_event`,';
        sql_insert_vals=sql_insert_vals + 'NOW(),';
    }else{
console.log('add_view_instance dataObj.url - has_event is false: ',dataObj.url);
    }
    
    
	if(found>0){//valid keys found (white list)
		sql_insert=self.utils.check_strip_last(sql_insert,',') + self.utils.check_strip_last(sql_insert_vals,',') + sql_insert_end;
	}else{//no valid keys found (white list)
        errArr.push('write_found_0');
		return false;}
if(doDebug){console.log("SQL: ",sql_insert);}
    var result=self.mysql_obj.query(sql_insert);
	
	self.apply_callback(result,callbacks,function(res,cbs,arg){//res,cbs,arg - arguments supplied from apply_callback()
        for(var _args=[],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.last)==='function'){callbacks.last.apply(self,_args);}//callbacks.last(this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
        for(var _args=['last'],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.callback)==='function'){callbacks.callback.apply(self,_args);}//callbacks.callback('last',this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
	});
};
indexerDB.prototype.update_view_instance=function(dataObj,callbacks,errArr,doDebug){
	var self=this,
		sql_update='UPDATE `url_sources` SET ',
		sql_update_vals='',
		found=0;
	if(typeof(dataObj)!=='object'){return false;}//no data
	if(typeof(callbacks)==='function'){callbacks={'callback':callbacks};}//if passed lazily
console.log("\n\n========= indexerDB.prototype.update_view_instance =========\n\n");
    var valid_res=self.valid_write_view_instance(dataObj,errArr,true);
    if(valid_res===false){return false;}
    if(!self.utils.obj_valid_key(dataObj,'id')){
        errArr.push('no_id_for_update');
        return false;
    }

    var has_modified=false,
        has_event=false;
	for(var k in dataObj){
		if(self.utils.obj_valid_key(dataObj,k)){//valid object key (non-prototype)
            if(k.toLowerCase()==='id'){continue;}
			if(self._.indexOf(self.table_keys.url_sources,k)!==-1){//valid db table column name
                var sql_val=dataObj[k];
                has_modified=(k.toLowerCase()==='date_modified'?true:has_modified);
                has_event=(k.toLowerCase()==='date_event'?true:has_event);
                if(k.indexOf('date_')===0 && sql_val==='CURRENT_TIMESTAMP' && !self.mysql_55_hack(k,sql_val)){//5.6 likes current timestamp
                    sql_val=sql_val;}
                else if(k.indexOf('date_')===0 && sql_val==='CURRENT_TIMESTAMP' && self.mysql_55_hack(k,sql_val)){//5.5 likes NOW()
                    sql_val='NOW()';}
                else{
                    sql_val=self.mysql_obj.escape(dataObj[k]);}
				sql_update_vals=sql_update_vals + '`'+k+'`=' + sql_val+',';
				found++;
			}
		}
	}
    
    if(found>0 && !has_modified && self.mysql_55_hack('date_modified','CURRENT_TIMESTAMP')){//5.5 doesn'ts auto-update
        sql_update_vals=sql_update_vals + '`date_modified`=NOW(),';}
    /*
    //commented because I believe the decsion around this column is suppose to auto update?
    if(found>0 && !has_event && self.mysql_55_hack('date_event','CURRENT_TIMESTAMP')){//5.5 doesn'ts auto-update
        sql_update_vals=sql_update_vals + '`date_event`=NOW(),';}*/
    
	if(found>0){//valid keys found (white list)
		sql_update=sql_update + self.utils.check_strip_last(sql_update_vals,',')+' WHERE id=' + self.mysql_obj.escape(dataObj.id) + ';';
	}else{//no valid keys found (white list)
        errArr.push('update_found_0');
		return false;}
    
if(doDebug){console.log("\n\n\t========= ========= indexerDB.prototype.update_view_instance \n\t",'sql_update ',sql_update,"\n\n");}

    var result=self.mysql_obj.query(sql_update);
	self.apply_callback(result,callbacks,function(res,cbs,arg){//res,cbs,arg - arguments supplied from apply_callback()
        for(var _args=[],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.last)==='function'){callbacks.last.apply(self,_args);}//callbacks.last(this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
        for(var _args=['last'],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.callback)==='function'){callbacks.callback.apply(self,_args);}//callbacks.callback('last',this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
	});	
};
indexerDB.prototype.add_css_source_instance=function(dataObj,callbacks){
    var self=this;
	if(typeof(dataObj)!=='object'){return false;}//no data
	if(typeof(callbacks)==='function'){callbacks={'callback':callbacks};}//if passed lazily
};
indexerDB.prototype.add_selector_content_index=function(dataObj,callbacks){
	var self=this,
		sql_insert='INSERT INTO `selector_content_index`(',
		sql_insert_vals=') VALUES (',
		sql_insert_end=');',
		found=0;
	if(typeof(dataObj)!=='object'){return false;}//no data
	if(typeof(callbacks)==='function'){callbacks={'callback':callbacks};}//if passed lazily
	for(var k in dataObj){
		if(self.utils.obj_valid_key(dataObj,k)){//valid object key (non-prototype)
			if(self._.indexOf(self.table_keys.selector_content_index,k)!==-1){//valid db table column name
				sql_insert=sql_insert+'`'+k+'`,';
				sql_insert_vals=sql_insert_vals+self.mysql_obj.escape(dataObj[k])+',';
				found++;
			}
		}
	}
	if(found>0){//valid keys found (white list)
		sql_insert=self.utils.check_strip_last(sql_insert,',') + self.utils.check_strip_last(sql_insert_vals,',') + sql_insert_end;
	}else{//no valid keys found (white list)
		return false;}
	
	var result=self.mysql_obj.query(sql_insert);
	self.apply_callback(result,callbacks,function(){
        for(var _args=[],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.last)==='function'){callbacks.last.apply(self,_args);}//callbacks.last(this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
        for(var _args=['last'],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.callback)==='function'){callbacks.callback.apply(self,_args);}//callbacks.callback('last',this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
	});
};
indexerDB.prototype.delete_view_instance=function(dataObj, callbacks){
	var self=this;
};
indexerDB.prototype.reset=function(tableList,callbacks){//temporary
	var self=this;
    var result=self.mysql_obj.query('TRUNCATE TABLE `url_sources`;');
	self.apply_callback(result,callbacks,function(){
        for(var _args=[],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.last)==='function'){callbacks.last.apply(self,_args);}//callbacks.last(this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
        for(var _args=['last'],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
        if(typeof(callbacks.callback)==='function'){callbacks.callback.apply(self,_args);}//callbacks.callback('last',this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        
	});
};

indexerDB.prototype.mysql_55_hack=function(dbKey,dateIn){//incomplete but basically a manual switch for now
	var self=this;
    return (self.mysql_obj.version=='5.5' && dateIn.toUpperCase()==='CURRENT_TIMESTAMP'?true:false);
};
module.exports = indexerDB;