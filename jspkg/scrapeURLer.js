function scrapeURLer(opts){
    if(!opts){opts={};}
	//modules
	this.utils=require('../jspkg/utils');
	this._ = require('underscore');
	this.merge = require('merge');
    this.$ = require('cheerio');
	
	//variables/settings
	//this.uri_parser=this.merge(true,{},{'*':this.capture_uri},(typeof(opts.uri_parser)==='object'?opts.uri_parser:{}));//regexp much be a object pkg {'regex':new RegExp(),'callback':function(){return string;}}
	this.uri_parser=this.merge(true,{},(typeof(opts.uri_parser)==='object'?opts.uri_parser:{}));////regexp much be a object pkg {'regex':new RegExp(),'callback':function(){return string;}}

	//plugin system
	this.plugin={//allows only for single functions
		'capture_uri_test_match':false,
        'capture_uri_test_match_wildcard':false,
        'pre_capture_uri':false,
		'capture_uri':false
	};
    for(var k in this.plugin){
        if(this.utils.obj_valid_key(opts,'plugin') && this.utils.obj_valid_key(opts.plugin, k) && typeof(opts.plugin[k])==='function'){
            this.plugin[k]=opts.plugin[k];}}
	
	this.init();//start!
}
scrapeURLer.prototype.init=function(){
	var self=this;
};
scrapeURLer.prototype.i_callback=function(hookIn,argsIn){//internal callback - pluginable hooks
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
scrapeURLer.prototype.uri_parse_test=function(kIn){
	var self=this,
        has_callback=false,
        has_regexp=false,
		found_key=false;
    if(self.utils.obj_valid_key(self.uri_parser,kIn)){
        try{if(self.uri_parser[kIn].regex instanceof RegExp){has_regexp=true;}}
        catch(e){}
        if(!has_regexp){
            try{if(self.uri_parser[kIn].regex.constructor === RegExp){has_regexp=true;}}
            catch(e){}
        }
        if(has_regexp && typeof(self.uri_parser[kIn].callback)==='function'){return 'r';}
    }

    try{
        if(typeof(self.uri_parser[kIn])==='function'){has_callback=true;}
    }catch(e){}
    if(has_callback){return 'f';}
    return false;
}
scrapeURLer.prototype.capture_uri_test=function(uriIn){
	var self=this,
        uri=uriIn,
        has_callback=false,
        has_regexp=false,
		found_key=false;
	for(var k in self.uri_parser){
		if(k==='*'){continue;}//skip the wildcard
		if(self.utils.obj_valid_key(self.uri_parser,k)){
            var res=self.uri_parse_test(k);
            if(res==='f'){has_callback=true;found_key=k;break;}
            else if(res==='r'){has_regexp=true;found_key=k;break;}
		}
	}
    
	if(has_callback || has_regexp){
        ///////\\\\\\\\\\PLUGIN HOOK capture_uri_test_match\\\\\\\\/////////
        var _args={'uri':uri,'found_key':found_key},//index keys mimic scope variables that should be passed
            key_list=self.utils.array_keys(_args),
            _vr='';
        self.i_callback('capture_uri_test_match',_args);
        for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
        ///////\\\\\\\\\\END PLUGIN HOOK capture_uri_test_match\\\\\\\\/////////
        
    }
    if(self.utils.obj_valid_key(self.uri_parser,'*')){
        var has_callback=false,
            has_regexp=false,
            matched_wildcard=false,
            res=self.uri_parse_test('*');
        if(res==='f'){has_callback=true;matched_wildcard=true;}
        else if(res==='r'){has_regexp=true;matched_wildcard=true;}        
    }
    
	if(matched_wildcard){
        ///////\\\\\\\\\\PLUGIN HOOK capture_uri_test_match\\\\\\\\/////////
        var _args={'uri':uri,'found_key':'*'},//index keys mimic scope variables that should be passed
            key_list=self.utils.array_keys(_args),
            _vr='';
        self.i_callback('capture_uri_test_match',_args);
        for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
        ///////\\\\\\\\\\END PLUGIN HOOK capture_uri_test_match\\\\\\\\/////////
        
        
        ///////\\\\\\\\\\PLUGIN HOOK capture_uri_test_match_wildcard\\\\\\\\/////////
        var _args={'uri':uri},//index keys mimic scope variables that should be passed
            key_list=self.utils.array_keys(_args),
            _vr='';
        self.i_callback('capture_uri_test_match_wildcard',_args);
        for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
        ///////\\\\\\\\\\END PLUGIN HOOK capture_uri_test_match_wildcard\\\\\\\\/////////
        
    }
    
    if(matched_wildcard!==false || found_key!==false){
        var captue_keys=[];
        if(matched_wildcard){captue_keys.push('*');}
        if(has_regexp){captue_keys.push(found_key);}
        return captue_keys;
    }
    return false;
};
scrapeURLer.prototype.capture_uri=function(uriIn, parseKey){
	var self=this,
		uri=(self.utils.basic_str(uriIn)?uriIn:'./'),
		parse_key=parseKey;

    if(typeof(parse_key)!=='object' && self.utils.basic_str(parse_key)){parse_key=[parse_key];}//make it an array!

	///////\\\\\\\\\\PLUGIN HOOK capture_uri\\\\\\\\/////////
	var _args={'uri':uri,'parse_key':parse_key},//index keys mimic scope variables that should be passed
		key_list=self.utils.array_keys(_args),
		_vr='';
	self.i_callback('pre_capture_uri',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK capture_uri\\\\\\\\/////////
//console.log('======= parse_key ',parse_key, ' self.uri_parser ',self.uri_parser, ' uri_parser_keys ',self.utils.array_keys(self.uri_parser));
    var found=false,
        uri_parser_keys=self.utils.array_keys(self.uri_parser);
    for(var i=0;i<parse_key.length;i++){//confirm matches
//console.log('self._.indexOf(uri_parser_keys,'+parse_key[i]+') ',self._.indexOf(uri_parser_keys,parse_key[i]));
        if(self._.indexOf(uri_parser_keys,parse_key[i])!==-1){
            if(found===false){found=[];}
            found.push(parse_key[i]);
        }
    }
//console.log('======= parse_key found ',found);
    if(found===false){return false;}
    
    for(var i=0;i<found.length;i++){
        var index_key=found[i];
        
        ///////\\\\\\\\\\PLUGIN HOOK capture_uri\\\\\\\\/////////
        var _args={'uri':uri,'index_key':index_key},//index keys mimic scope variables that should be passed
            key_list=self.utils.array_keys(_args),
            _vr='';
        self.i_callback('pre_capture_uri',_args);
        for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
        ///////\\\\\\\\\\END PLUGIN HOOK capture_uri\\\\\\\\/////////
        
        var test_res=self.uri_parse_test(index_key);
        if(test_res==='f'){
            uri=self.uri_parser[index_key].apply(self,[uri]);
        }else if(test_res==='r'){
            var reg_matches=uri.match(self.uri_parser[index_key].regex);
            if(reg_matches!==null){
                uri=self.uri_parser[index_key].callback.apply(self,[uri,self.uri_parser[index_key].regex]);
            }
        }
    }
	return uri;
};
scrapeURLer.prototype.terminate=function(){
	var self=this;
};
module.exports = scrapeURLer;