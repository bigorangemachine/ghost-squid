//http://stackoverflow.com/questions/20534702/node-js-use-of-module-exports-as-a-constructor
function Cacher(opts){
    if(!opts){opts={};}
	//modules
	this.utils=require('../jspkg/utils');
	this.fs=require('fs');
	this.url = require('url');
	this.merge=require('merge');
	this._ = require('underscore');
	this.md5=require('MD5');
	//variables/settings
	this.doc_root=opts.doc_root;
	this.no_ext='un-file';
	this.cache_dir='_cache/_files/';
	this.cache_path='';//set in init
	this.use_auth=(typeof(opts.auth)==='object'?{'user':opts.auth.user,'pass':opts.auth.pass}:false);

	//plugin system
	this.plugin={//allows only for single functions
		'init':false,
		'file_request_post_data':false,
		'pre_file_request':false,
		'get_file_name':false,
		'file_request_write':false,
		'file_request_close':false,
		'file_request_error':false
	};
    for(var k in this.plugin){
        if(this.utils.obj_valid_key(opts,'plugin') && this.utils.obj_valid_key(opts.plugin, k) && typeof(opts.plugin[k])==='function'){
            this.plugin[k]=opts.plugin[k];}}
	
	this.init();
}
Cacher.prototype.init=function(){
	var self=this,
		date_str={'y':new Date().getFullYear().toString(),'m':((new Date().getMonth())+1),'d':new Date().getDate()};
	date_str.m=(date_str.m.toString().length==1?'0':'')+date_str.m;
	date_str.d=(date_str.d.toString().length==1?'0':'')+date_str.d;
	var cache_path=self.doc_root+self.cache_dir;
	if(!self.fs.existsSync(cache_path)){self.fs.mkdirSync(cache_path);}//create base cache dir
	cache_path=cache_path+date_str.y+date_str.m+date_str.d+'/';
	
	///////\\\\\\\\\\PLUGIN HOOK init\\\\\\\\/////////
	var _args={'cache_path':cache_path,'date_str':date_str},//index keys mimic scope variables that should be passed
		key_list=self.utils.array_keys(_args),
		_vr='';
	self.i_callback('init',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK init\\\\\\\\/////////
	
	if(!self.fs.existsSync(cache_path)){//create datestamped directory
		self.fs.mkdirSync(cache_path);}
	self.cache_path=cache_path;
};
Cacher.prototype.i_callback=function(hookIn,argsIn){//internal callback - pluginable hooks
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
Cacher.prototype.get_file_name=function(fileNameIn, urlReq){
	var self=this,
		exts=fileNameIn.split('.'),
		ext=(exts.length>1?exts[exts.length-1]:self.no_ext),
		full_filename=self.md5(urlReq);


    var date_obj=new Date(),
        date_str={'y':date_obj.getFullYear().toString(),'m':((date_obj.getMonth())+1),'d':date_obj.getDate(),'h':date_obj.getHours(),'min':date_obj.getMinutes(),'s':date_obj.getSeconds()};
    date_str.m=(date_str.m.toString().length==1?'0':'')+date_str.m;
    date_str.d=(date_str.d.toString().length==1?'0':'')+date_str.d;
    date_str.h=(date_str.h.toString().length==1?'0':'')+date_str.h;
    date_str.min=(date_str.min.toString().length==1?'0':'')+date_str.min;
    date_str.s=(date_str.s.toString().length==1?'0':'')+date_str.s;
    
    full_filename=date_str.h.toString()+date_str.min.toString()+date_str.s.toString()+'-'+ full_filename+'.'+ ext;  

	///////\\\\\\\\\\PLUGIN HOOK get_file_name\\\\\\\\/////////
	var _args={'ext':ext,'full_filename':full_filename},//index keys mimic scope variables that should be passed
		key_list=self.utils.array_keys(_args),
		_vr='';
	self.i_callback('get_file_name',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK get_file_name\\\\\\\\/////////

	return full_filename;
};
Cacher.prototype.file_request=function(urlReq,captureOpts,captureCallback){
	var self=this,
		http=require('http'),
		req_url=self.url.parse(urlReq),
		default_options={
			'hostname':req_url.hostname,
			'path':req_url.pathname + (req_url.query && req_url.query.length>0?'?'+req_url.query:''),
			'headers': {
				//'Set-Cookie': ["type=ninja", "language=javascript"],
			},
			'method': 'GET'
		},
		options=self.merge(true,{},default_options,(typeof(captureOpts)=='object' && captureOpts!==null?captureOpts:{})),
		file_name = req_url.pathname.split('/').pop();
	file_name = (file_name.indexOf('?')!==-1?file_name.split('?')[0]:file_name);
	var full_filename=self.get_file_name(file_name, urlReq, options);
	//adjust options
	if(self.use_auth!==false){
		options.auth=self.use_auth.user+':'+self.use_auth.pass;
	}
	if(options.method.toUpperCase()=='POST' && options.post_data){
		options.headers['Content-Type']='application/x-www-form-urlencoded';//content-type is only needed for POST
		options.headers['Content-Length']=Buffer.byteLength(options.post_data);
	}
console.log('======capture_function====',urlReq,"\n","full_filename ",full_filename,"\n",'options',options);
	if(options.status!==200 && options.status!==304){
		///////\\\\\\\\\\PLUGIN HOOK pre_file_request\\\\\\\\/////////
		var _args={'options':options,'req_url':req_url,'full_filename':full_filename},//index keys mimic scope variables that should be passed
			key_list=self.utils.array_keys(_args),
			_vr='';
		self.i_callback('pre_file_request',_args);
		for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
		///////\\\\\\\\\\END PLUGIN HOOK pre_file_request\\\\\\\\/////////

		var http_req=http.request(options,function(res){//md5 the contents, get, post, cookies
			var file = self.fs.createWriteStream(self.cache_path + full_filename);
			res.on('data', function(data){

				///////\\\\\\\\\\PLUGIN HOOK file_request_write\\\\\\\\/////////
				var _args={'data':data,'options':options,'req_url':req_url,'res':res},//index keys mimic scope variables that should be passed
					key_list=self.utils.array_keys(_args),
					_vr='';
				self.i_callback('file_request_write',_args);
				for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
				///////\\\\\\\\\\END PLUGIN HOOK file_request_write\\\\\\\\/////////

				file.write(data);
			}).on('end', function() {
				if(typeof(captureCallback)=='function'){
					captureCallback.apply(this,[full_filename,options,file]);}

				///////\\\\\\\\\\PLUGIN HOOK file_request_close\\\\\\\\/////////
				var _args={'options':options,'req_url':req_url,'res':res,'captureCallback':captureCallback},//index keys mimic scope variables that should be passed
					key_list=self.utils.array_keys(_args),
					_vr='';
				self.i_callback('file_request_close',_args);
				for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
				///////\\\\\\\\\\END PLUGIN HOOK file_request_close\\\\\\\\/////////

				file.end();
			});
		});
		if(options.method.toUpperCase()=='POST'){
			var post_data=options.post_data;

			///////\\\\\\\\\\PLUGIN HOOK file_request_post_data\\\\\\\\/////////
			var _args={'post_data':post_data,'http_req':http_req,'req_url':req_url,'full_filename':full_filename},//index keys mimic scope variables that should be passed
				key_list=self.utils.array_keys(_args),
				_vr='';
			self.i_callback('file_request_post_data',_args);
			for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
			///////\\\\\\\\\\END PLUGIN HOOK file_request_post_data\\\\\\\\/////////

			http_req.write(post_data);
		}
		http_req.on('error', function(e) {
			console.log('problem with request: ' , e);


			///////\\\\\\\\\\PLUGIN HOOK file_request_error\\\\\\\\/////////
			var _args={'post_data':post_data,'http_req':http_req,'req_url':req_url,'full_filename':full_filename},//index keys mimic scope variables that should be passed
				key_list=self.utils.array_keys(_args),
				_vr='';
			self.i_callback('file_request_error',_args);
			for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
			///////\\\\\\\\\\END PLUGIN HOOK file_request_error\\\\\\\\/////////

		});
		http_req.end();//this is needed!?!
	}
};
Cacher.prototype.cache_raw=function(strIn,urlReq){
	var self=this,
        full_filename='',
        req_url=self.url.parse(urlReq),
        file_name = req_url.pathname.split('/').pop();
	
    file_name = (file_name.indexOf('?')!==-1?file_name.split('?')[0]:file_name);
	full_filename=self.get_file_name(file_name, urlReq);
    
    self.fs.writeFileSync(self.cache_path + full_filename, strIn);    
	return self.utils.check_strip_first(self.cache_path,self.doc_root+self.cache_dir) + full_filename;
};
Cacher.prototype.cache_open=function(filePath){
	var self=this,
        file_path=self.doc_root+self.cache_dir + self.utils.check_strip_first(filePath,self.doc_root+self.cache_dir);
	
	return self.fs.readFileSync(file_path).toString();
};
Cacher.prototype.reset=function(){
	var self=this;
    //self.terminate();
//console.log("=====CACHER RESET ",self.doc_root+self.cache_dir);
    self.utils.delete_dir_all(self.fs, self.doc_root+self.cache_dir);
};
module.exports = Cacher;