function Phrowser(opts,readyCB){
    if(!opts){opts={};}
	//modules
	this.utils=require('../jspkg/utils');
	this.phantom=require('phantom');
	this._ = require('underscore');
	this.merge=require('merge');
    this.querystring = require('querystring');
    this.url = require('url');
	//variables/settings
	//this.timeout_ids={'loaded_complete':false};
	this.interval_ids={'loaded_complete':false};
	this.mutables={
		'visibles':[],
		'hiddens':[]
	};
	this.event_chain=[];
    this.debug_levels={'off':0,'on':1,'all':10};
    this.debug_level=this.debug_levels.on;
	this.cacher=opts.cacher;
    this.PH_server=false;//phantom.create() - return
	this.PH_js_obj=false;//first arg of phantom.create()
	this.PH_webpage_obj=false;//first arg of PH_js_obj.createPage() - essentially a tab
	this.use_auth=(typeof(opts.auth)==='object'?{'user':opts.auth.user,'pass':opts.auth.pass}:false);
	this.headers_schema={
        'r_type':false, //req/res aka request or response
        'name':false, //init/method/redirect or header key
        'value':false,//value of header key - 
        'url':false,//url of resource - redirects treated wtiin 'name':'redirect' space
        'file_type':false//content-type text/html
    };
	this.headers=[];
	this.init_url=false;//set in .open() unset in .close()
	//plugin system
	this.plugin={//allows only for single functions
		'init':false,//Phrowser initiate
		'on_console':false,//whenever the browsed page console.logs
		'on_page_init':false,//whenever the browsed page starts (created)
		'on_url_changed':false,//whenever the browsed page changes url/redirects
		'on_resource_requested':false,//whenever the browsed page pull external resource
		'on_resource_received_loaded':false,//whenever the browsed page pull finished downloading an external resource (image/css/js/json/ajax)
		'on_load_started':false,//whenever the browsed page starts to request url
		'on_load_finished_success':false,//whenever the browsed page is 'ready'
		'on_pre_open':false,//just before the url is entered/visited
		'on_open':false,//when the url has been 'opened'
		'on_terminate':false//on terminated
	};
    for(var k in this.plugin){
        if(this.utils.obj_valid_key(opts,'plugin') && this.utils.obj_valid_key(opts.plugin, k) && typeof(opts.plugin[k])==='function'){
            this.plugin[k]=opts.plugin[k];}}
	
	this.init( (typeof(opts.ready_callback)=='function'?opts.ready_callback:readyCB) );//start!
}
Phrowser.prototype.init=function(readyCB){
	var self=this;
	
	///////\\\\\\\\\\PLUGIN HOOK init\\\\\\\\/////////
	var _args={},//index keys mimic scope variables that should be passed
		key_list=self.utils.array_keys(_args),
		_vr='';
	self.i_callback('init',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK init\\\\\\\\/////////
	

	self.PH_server=self.phantom.create(function(ph){
		self.PH_js_obj=ph;
        self.init_page(readyCB);
	});//, {'path': '/usr/local/bin/'}
    //},{'path':'/home/pi/phantomjs-raspberrypi/bin/'});
};
Phrowser.prototype.init_page=function(readyCB){
	var self=this;
    self.PH_js_obj.createPage(function(page){
        self.PH_webpage_obj=page;
        if(self.use_auth!==false){
            self.PH_webpage_obj.set('settings.userName', self.use_auth.user);
            self.PH_webpage_obj.set('settings.password', self.use_auth.pass);
        }
        self.PH_webpage_obj.set('onConsoleMessage',function(msg, lineNum, sourceId){
            var line_num=lineNum,
                source_id=sourceId;

            ///////\\\\\\\\\\PLUGIN HOOK on_console\\\\\\\\/////////
            var _args={'msg':msg, 'line_num':line_num, 'source_id':source_id},//index keys mimic scope variables that should be passed
                key_list=self.utils.array_keys(_args),
                _vr='';
            self.i_callback('on_console',_args);
            for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
            ///////\\\\\\\\\\END PLUGIN HOOK on_console\\\\\\\\/////////
        });
        self.PH_webpage_obj.set('onUrlChanged', function(url) {
            ///////\\\\\\\\\\PLUGIN HOOK on_url_changed\\\\\\\\/////////
            var _args={'url':url},//index keys mimic scope variables that should be passed
                key_list=self.utils.array_keys(_args),
                _vr='';
            self.i_callback('on_url_changed',_args);
            for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
            ///////\\\\\\\\\\END PLUGIN HOOK on_url_changed\\\\\\\\/////////

            self.add_event_link('UrlChanged');

        });

        self.PH_webpage_obj.set('onResourceRequested', function (req) {
if(self.init_url!==false){
    var r_url_obj=self.url.parse(req.url),
        init_url_obj=self.url.parse(self.init_url);
    if(typeof(r_url_obj.url)==='string' && r_url_obj.host==init_url_obj.host){
    self.do_debug(self.debug_levels.all) && console.log("\n\n================== PHROWSER  onResourceRequested ============="+"\n\t"," req.ur: ",req.url,"=============================================================\n\n");
}}
            ///////\\\\\\\\\\PLUGIN HOOK on_resource_requested\\\\\\\\/////////
            var _args={'req':req},//index keys mimic scope variables that should be passed
                key_list=self.utils.array_keys(_args),
                _vr='';
            self.i_callback('on_resource_requested',_args);
            for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
            ///////\\\\\\\\\\END PLUGIN HOOK on_resource_requested\\\\\\\\/////////

            var cap_url=(self.init_url!==req.url?req.url:'.'),
                _r='req',
                this_header={'r_type': _r,'name':'init','value':true,'url':cap_url,'file_type':false};
            self.headers.push(self.merge(true,{},self.headers_schema,this_header));
            this_header={'r_type': _r,'name':'method','value':req.method,'url':cap_url,'file_type':false};
            self.headers.push(self.merge(true,{},self.headers_schema,this_header));
            if(req.headers.length>0){
                for(var r=0;r<req.headers.length;r++){
                    this_header={'r_type': _r,'name':req.headers[r].name,'value':req.headers[r].value,'url':cap_url,'file_type':false};
                    self.headers.push(self.merge(true,{},self.headers_schema,this_header));
                }
            }

        });
        self.PH_webpage_obj.set('onResourceReceived', function (res) {
            if (res.stage == 'end') {
if(self.init_url!==false){
    var r_url_obj=self.url.parse(res.url),
        init_url_obj=self.url.parse(self.init_url);
    if(typeof(r_url_obj.url)==='string' && r_url_obj.host==init_url_obj.host){
    self.do_debug(self.debug_levels.all) && console.log("\n\n================== PHROWSER  onResourceReceived ============="+"\n\t"," res.url: ",res.url,"=============================================================\n\n");
}}
                //self.find_mutables();

                ///////\\\\\\\\\\PLUGIN HOOK on_resource_received_loaded\\\\\\\\/////////
                var _args={'res':res},//index keys mimic scope variables that should be passed
                    key_list=self.utils.array_keys(_args),
                    _vr='';
                self.i_callback('on_resource_received_loaded',_args);
                for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
                ///////\\\\\\\\\\END PLUGIN HOOK on_resource_received_loaded\\\\\\\\/////////

                var cap_url=(self.init_url!==res.url?res.url:'.'),
                    _r='res',
                    content_type=res.contentType,
                    this_header={'r_type': _r,'name':'init','value':true,'url':cap_url,'file_type':content_type};

                self.add_event_link('ResourceReceived',{'detail':{'url':cap_url,'file_type':content_type}});

                self.headers.push(self.merge(true,{},self.headers_schema,this_header));
                this_header={'r_type': _r,'name':'method','value':res.method,'url':cap_url,'file_type':content_type};
                self.headers.push(self.merge(true,{},self.headers_schema,this_header));
                this_header={'r_type': _r,'name':'status','value':res.status,'url':cap_url,'file_type':content_type};
                self.headers.push(self.merge(true,{},self.headers_schema,this_header));
                if(self.utils.obj_valid_key(res, 'redirectURL')){
                    this_header={'r_type': _r,'name':'redirect','value':res.redirectURL,'url':cap_url,'file_type':content_type};
                    self.headers.push(self.merge(true,{},self.headers_schema,this_header));
                }
                if(res.headers.length>0){
                    for(var r=0;r<res.headers.length;r++){
                        this_header={'r_type': _r,'name':res.headers[r].name,'value':res.headers[r].value,'url':cap_url,'file_type':content_type};
                        self.headers.push(self.merge(true,{},self.headers_schema,this_header));
                    }
//console.log('======self.headers ',self.headers);
                }
            }
        });

        self.PH_webpage_obj.set('onLoadStarted', function () {
self.do_debug(self.debug_levels.all) && console.log("===== PHROWSER onLoadStarted: ");

            ///////\\\\\\\\\\PLUGIN HOOK on_load_started\\\\\\\\/////////
            var _args={},//index keys mimic scope variables that should be passed
                key_list=self.utils.array_keys(_args),
                _vr='';
            self.i_callback('on_load_started',_args);
            for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
            ///////\\\\\\\\\\END PLUGIN HOOK on_load_started\\\\\\\\/////////
        });

        self.PH_webpage_obj.set('onResourceError', function (err) {
self.do_debug(self.debug_levels.all) && console.log('======= PHANONTOM FAIL onResourceError',err);
            
        });
        self.PH_webpage_obj.set('onError', function (err) {
self.do_debug(self.debug_levels.all) && console.log('======= PHANONTOM FAIL onError',err);
            
        });
        self.PH_webpage_obj.set('onLoadFinished', function (status) {
self.do_debug(self.debug_levels.all) && console.log("===== PHROWSER onLoadFinished: " +
"Page is "+(status == "success"? "open." : "not open!"), "\n",
(arguments.length>1?arguments:''),(arguments.length>1?"\n\n":''));
            if(status == "success"){
                //self.find_mutables();
                ///////\\\\\\\\\\PLUGIN HOOK on_load_finished_success\\\\\\\\/////////
                var _args={},//index keys mimic scope variables that should be passed
                    key_list=self.utils.array_keys(_args),
                    _vr='';
                self.i_callback('on_load_finished_success',_args);
                for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
                ///////\\\\\\\\\\END PLUGIN HOOK on_load_finished_success\\\\\\\\/////////
            }
        });

        if(typeof(readyCB)=='function'){readyCB.apply(self);}
        
        ///////\\\\\\\\\\PLUGIN HOOK on_page_init\\\\\\\\/////////
        var _args={},//index keys mimic scope variables that should be passed
            key_list=self.utils.array_keys(_args),
            _vr='';
        self.i_callback('on_page_init',_args);
        for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
        ///////\\\\\\\\\\END PLUGIN HOOK on_page_init\\\\\\\\/////////
    });//,{'path':'/usr/local/Cellar/phantomjs/1.9.8/bin'}
}
Phrowser.prototype.is_ready=function(callback){
	var self=this;
	if(typeof(callback)!=='function'){return false;}
	if(self.PH_js_obj===false && self.PH_webpage_obj===false){
		//throw an error -> this is a temporary fix.  I should build a way to have more than 1 callback per callback type
		if(typeof(self.plugin.on_page_init)==='function'){
			var err=new Error("Phrowser Error: in 'is_ready' - Page Init Handler is Set. Modify your handler please");throw err;return false;}
		//otherwise we set the callback
		self.plugin.on_page_init=callback;
	}else{//just call the callback!
		callback.apply(self);}
};

Phrowser.prototype.add_event_link=function(typeIn,dataIn){
	var self=this,
		new_link=self.merge(true,{'type':typeIn},(typeof(dataIn)=='object' && dataIn!==null?dataIn:{}));
	if(typeof(new_link.timeStamp)=='undefined'){new_link.timeStamp=new Date();}
	self.event_chain.push(new_link);
}
Phrowser.prototype.i_callback=function(hookIn,argsIn){//internal callback - pluginable hooks
	var self=this,
		has_callback=false;
	try{
		if(typeof(self.plugin[hookIn])==='function'){has_callback=true;}
	}catch(e){}
	if(has_callback){
		var args=[argsIn];//wrap in array for func.apply() but we use a variable so we can take advantage of PbR
		self.plugin[hookIn].apply(self, args);
		argsIn=args[0];//push values up
		return true;
	}
	return false;
};
Phrowser.prototype.open=function(reqUrl, opts){
	var self=this,
        open_defaults={'method':'GET','data':{'GET':false,'POST':false,'COOKIES':false,'PAYLOAD':false},'referer':''},
        open_opts=self.merge(true, open_defaults, (typeof(opts)==='object'?opts:{})),
		open_url=reqUrl,
        open_method='GET';

    if(open_opts.method.toUpperCase()==='POST'){open_method='POST';}
    open_opts.data.GET=(typeof(open_opts.data.GET)==='string'?self.querystring.parse(open_opts.data.GET):open_opts.data.GET);//should be object
    open_opts.data.POST=(typeof(open_opts.data.POST)==='string'?self.querystring.parse(open_opts.data.POST):open_opts.data.POST);//should be object
    open_opts.data.COOKIES=(typeof(open_opts.data.COOKIES)==='object' && open_opts.data.COOKIES instanceof Array?open_opts.data.COOKIES:[open_opts.data.COOKIES]);//should be object
    //open_opts.data.PAYLOAD;//should be string?
    if(open_url.indexOf('?')!==-1){//does get string exist in the URL - Merge it in!
        var _ex=open_url.split('?');
        open_url=_ex[0];//slice is damaging?!
        var qry_obj=self.querystring.parse(_ex.slice(1, _ex.length).join('?'));
        open_opts.data.GET=self.merge(true, {}, qry_obj, (typeof(open_opts.data.GET)==='object'?open_opts.data.GET:{}));
    }
    if(open_method==='POST' && typeof(open_opts.data.POST)==='object'){//if POST! and OBJECT
        open_opts.data.POST=self.querystring.stringify(open_opts.data.POST);}
    
    var get_str=(typeof(open_opts.data.GET)==='object'?'?'+self.querystring.parse(open_opts.data.GET):'?'+self.utils.check_strip_first(open_opts.data.GET, '?'));
    open_opts.method=open_method;
    open_url=(open_opts.method.toUpperCase()!=='GET' && self.utils.basic_str(get_str)?open_url+get_str:open_url);//if not GET, set the URL to include the GET data

	///////\\\\\\\\\\PLUGIN HOOK on_pre_open\\\\\\\\/////////
	var _args={'open_url':open_url,'open_opts':open_opts},//index keys mimic scope variables that should be passed
		key_list=self.utils.array_keys(_args),
		_vr='';
	self.i_callback('on_pre_open',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK on_pre_open\\\\\\\\/////////
    
    
    if(self.utils.basic_str(open_opts.referer)){
        self.PH_webpage_obj.customHeaders = self.merge(true,{},self.PH_webpage_obj.customHeaders,{'Referer': open_opts.referer});}
    
    if(open_opts.data.COOKIES instanceof Array && open_opts.data.COOKIES.length>0){
        var url_obj=self.url.parse(open_url);
        url_obj.host='.'+self.utils.check_strip_first(self.utils.check_strip_first(url_obj.host, 'www.'), '.');

        var cookie_schema={
                'name': null, /* required property */
                'value': null, /* required property */
                'domain': url_obj.host,
                'path': url_obj.pathname, /* required property */
                'httponly': false,
                'secure': false,
                'expires': new Date().getTime() + (1000 * 15 * 60)
            };
        for(var i=0;i<open_opts.data.COOKIES.length;i++){
            if(self.utils.obj_valid_key(open_opts.data.COOKIES[i],'name') && self.utils.obj_valid_key(open_opts.data.COOKIES[i],'value') && self.utils.obj_valid_key(open_opts.data.COOKIES[i],'path')){
                var this_cookie=self.merge(true, {}, cookie_schema, open_opts.data.COOKIES[i]);
                self.PH_js_obj.addCookie(this_cookie);
            }
        }
    }
    
    self.init_url=open_url;
    
    var open_args=[open_url];
    open_args.push(open_opts.method);//self.PH_webpage_obj.open(open_url, open_opts.method);
    open_args.push((open_opts.method.toUpperCase()==='GET'?open_opts.data.GET:open_opts.data[ (open_opts.method.toUpperCase()) ]));//self.PH_webpage_obj.open(open_url, open_opts.method, (open_opts.method.toUpperCase()==='GET'?open_opts.data.GET:open_opts.data[ (open_opts.method.toUpperCase()) ]));
    open_args.push(function(status){
self.do_debug(self.debug_levels.on) && console.log("Phrowser opened ? "+open_url,"\n","status", status);

        if(status!=="success"){//use to debug self.PH_webpage_obj  - maybe not needed?!
self.do_debug(self.debug_levels.on) && console.log('======= PHANONTOM FAIL',status,"\n.reason: ",self.PH_webpage_obj.reason);}
        var allow_terminate=true;

        ///////\\\\\\\\\\PLUGIN HOOK on_open\\\\\\\\/////////
        var _args={'open_url':open_url,'open_opts':open_opts,'status':status,'allow_terminate':allow_terminate},//index keys mimic scope variables that should be passed
            key_list=self.utils.array_keys(_args),
            _vr='';
        self.i_callback('on_open',_args);
        for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
        ///////\\\\\\\\\\END PLUGIN HOOK on_open\\\\\\\\/////////

        if(allow_terminate){self.terminate();}

    });//self.PH_webpage_obj.open(open_url, open_opts.method, data, open_callback);
    self.PH_webpage_obj.open.apply(self.PH_webpage_obj, open_args);
	//self.PH_webpage_obj.open(open_url, open_callback);//old
};
Phrowser.prototype.find_mutables=function(){
	var self=this,
		visibles=[],
		hiddens=[];
	self.PH_webpage_obj.evaluate(function(){ return (typeof(jQuery)=='function'?$(':visible'):null); }, function (vis) {
		if(typeof(vis)=='undefined' || vis===null){return;}
console.log('vis',vis.length);
		for(var v=0;v<vis.length;v++){visibles.push(vis[v]);}
		var the_olds=self._.difference(self.mutables.visibles,visibles),
			the_news=self._.difference(visibles,self.mutables.visibles),
			list=the_olds.concat(the_news);
console.log('B4',list.length);
		list=self._.uniq(list);
console.log('AF',list.length);
console.log('the_olds',the_olds.length);
console.log('the_news',the_news.length);
console.log('========VISIBLES============',(self._.isEqual(self.mutables.visibles, visibles)?'NO CHANGE':'----CHANGED---'));
if(list.length===0){return;}
//console.log('list',list,"\n\n\n",'the_olds',the_olds,"\n\n\n",'the_news',the_news);
	for(var o=0;o<list.length;o++){
		if(self._.contains(the_olds,list[o])){console.log('======found======',list[o].nodeType,' id=',(list[o].id?list[o].id:'NOID'),' class=',(list[o].className?list[o].className:'NOID'));}
		for(var v=0;v<the_olds.length;v++){}
	}
console.log('====================');
		for(var l=0;l<list.length;l++){
			if(list[l]===null){continue;}
console.log((list[l].nodeName?list[l].nodeName:'[NULL]'),(list[l].id?'#'+list[l].id:'NOID'),'  ---- ',(list[l].className?'.'+list[l].className:''));
		}
console.log('======== \\\\ VISIBLES============');

		self.mutables.visibles=visibles;
	});
	self.PH_webpage_obj.evaluate(function(){ return (typeof(jQuery)=='function'?$(':not(:visible)'):null); }, function (vis) {
		if(typeof(vis)=='undefined' || vis===null){return;}
		for(var v=0;v<vis.length;v++){hiddens.push(vis[v]);}
console.log('========HIDDENS============',(self._.isEqual(self.mutables.hiddens, hiddens)?'NO CHANGE':'----CHANGED---'));
		self.mutables.hiddens=hiddens;
	});
};
Phrowser.prototype.stop=function(callback){
	var self=this;
	self.PH_webpage_obj.evaluate(function(){
        window.stop();
    },function(){

self.do_debug(self.debug_levels.on) && console.log('===PHROWSER STOP===');
        
        if(typeof(callback)==='function'){callback.apply(this,[]);}
    });
};
Phrowser.prototype.clear_cookies=function(callback){
	var self=this;
self.do_debug(self.debug_levels.all) && console.log('===PHROWSER CLEAR COOKIES===');
    if(typeof(self.PH_js_obj)==='object'){
        self.PH_js_obj.clearCookies(function(){
self.do_debug(self.debug_levels.all) && console.log("\t",'===PHROWSER CLEAR COOKIES===');
            if(typeof(callback)==='function'){callback.apply(self,[]);}
        });
    }
};
Phrowser.prototype.uninit=function(callback){
	var self=this;
    self.headers=[];
    self.init_url=false;
    self.PH_webpage_obj=false;
    self.clear_cookies(function(){
self.do_debug(self.debug_levels.all) && console.log("\t",'===PHROWSER UNINIT===');
        if(typeof(callback)==='function'){callback.apply(self,[]);}
    });
};
Phrowser.prototype.close=function(callback){
	var self=this;
self.do_debug(self.debug_levels.all) && console.log('===PHROWSER CLOSE===');
    if(typeof(self.PH_js_obj)!=='object'){return false;}
    
    // close and unset status
    self.uninit(function(){
        if(typeof(self.PH_webpage_obj)==='object'){
            self.PH_webpage_obj.close();}
self.do_debug(self.debug_levels.all) && console.log("\t",'===PHROWSER CLOSE===');
        if(typeof(callback)==='function'){callback.apply(self,[]);}
    });
    
    // \\ close and unset status
};
Phrowser.prototype.terminate=function(callback){
	var self=this,
		allow_terminate=true;

self.do_debug(self.debug_levels.all) && console.log('===PHROWSER TERMINATE===');

    ///////\\\\\\\\\\PLUGIN HOOK on_terminate\\\\\\\\/////////
    var _args={'allow_terminate':allow_terminate},//index keys mimic scope variables that should be passed
        key_list=self.utils.array_keys(_args),
        _vr='';
    self.i_callback('on_terminate',_args);
    for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
    ///////\\\\\\\\\\END PLUGIN HOOK on_terminate\\\\\\\\/////////
    if(allow_terminate){

self.do_debug(self.debug_levels.all) && console.log('===PHROWSER self.close()===');
        var close_func=function(){
self.do_debug(self.debug_levels.all) && console.log("\t"+'===PHROWSER self.close()->close_func - typeof(self.PH_js_obj): '+typeof(self.PH_js_obj)+' ===');
			if(typeof(self.PH_js_obj)==='object'){self.PH_js_obj.exit();}
            if(typeof(callback)==='function'){callback.apply(self,[]);}
self.do_debug(self.debug_levels.all) && console.log("\t"+'===PHROWSER self.close===');
        },
        close_res=self.close(close_func);
        if(!close_res){close_func();}
    }
};
Phrowser.prototype.do_debug=function(val){
    var self=this;
    if(!self.debug_level || self.debug_level<=parseInt(self.debug_levels.off)){
        return false;}
    if(parseInt(val)<parseInt(self.debug_level)){return false;}
    return true;
};
module.exports = Phrowser;
