module.exports = function(fs, utils, _, merge){

//modules
//var _ = require('underscore'),
//        fs=require('fs'),
//        utils=require('../jspkg/utils');
//        merge = require('merge');
        
function CronStep(opts){
    if(!opts){opts={};}
	
	//variables/settings
    this.log_path=false;//set in init(); realtive path concatenated this.log_dir and this.ident 
    this.exc_start_time=false;//set in step();
    this.thread_ident=false;//set in init(); - instance id
    this.thread_inc=0;//set in setp(); - how many times step been fired
    this.logger_schema={'success':[],'fail':[],'success_inc':0,'fail_inc':0,'file_inc':0,'file_alpha_inc':'','file_inc_max':999999};//Number.MAX_VALUE big number!
    this.logger=merge(true,{},this.logger_schema);
    this.logger_max_size=(utils.obj_valid_key(opts,'logger_max_size')?opts.logger_max_size:5*1024);//in kb default 5 MB
    this.exceed_time=(utils.obj_valid_key(opts,'exceed_time')?opts.exceed_time:60);//in seconds - setting to false is essentially infinite (system will timeout with max execution error)
    this.step_interval_time=(utils.obj_valid_key(opts,'step_interval_time')?opts.step_interval_time:5000);
    this.step_timeout_time=(utils.obj_valid_key(opts,'step_timeout_time')?opts.step_timeout_time:5000);
    this.step_interval_id=false;
    this.step_timeout_id=false;
    this.is_step=false;//set in init_step();
	this.ident=(utils.obj_valid_key(opts,'ident')?opts.ident:(new Date().getTime().toString()));//project id
	this.log_dir=(utils.obj_valid_key(opts,'log_dir')?opts.log_dir:'_cache/_step_log/');//relative path from doc_root
	this.logger_file='log.json.log';
    this.lockloss_logger_file='lockloss.json.log';
	this.manifest_file='manifest_data.json';
	this.lock_file='lock.json';
    this.doc_root=opts.doc_root;
	this.lock_schema={
        'thread_ident':false,
        'lock_timeout':false,//in seconds defaults to 45 minutes (45 x 60sec = 2700)
        'last_lock':false
    };
    this.o_lock=merge(true,this.lock_schema,{'thread_ident':this.thread_ident,'lock_timeout':45*60},(utils.obj_valid_key(opts,'o_lock')?opts.o_lock:{}));//use this to manage the locking mechanism
    this.cache_schema={
        'thread_ident':false,//does not repopulate from cache
        'ident':false,
        'added_properties':[],//{'key_id':'adfadsfa','default_val':false}
        logger:{
            'success_inc':0,
            'fail_inc':0,
        },
        'step':{
            'inc':false,
            'current':false,
            'steps':false
        },
        'offset':{
            'size':false,
            'inc':false
        }
    };
    this.cache_key_blacklist=utils.array_keys(this.cache_schema);
    this.cache_data=merge(true,{},this.cache_schema);
    var step_defaults={
            'inc':false, //count or increment
            'current':false, //which step number is it - array index num
            'steps':[], 
            'callback':{//match 'steps' as index key the contain functions
             //'steps:['sample_step'] // if the steps only contained a value of 'sample_step' you need to match it in the callback index keys
                /*'sample_step':{
                    'next_step':function(pkg){//test if we can abandon this step - true or false - init() triggered only done on start
                        
                    },
                    'start':function(pkg){//onstart/onready of the step cycle
                        
                    },
                    ////what is our active part - returning true/false will indicate a success/fault increment - return a function to indicate an async request
                    // - pkg: {'log_data':{}}
                    // - nextCallback: if you return a function you must return true/false within this function to indicate a success/fault increment
                    'action':function(pkg, nextCallback){
                        
                    },
                    'end':function(pkg){//on end cronstep
                        
                    },
                    'terminate':function(pkg){//onshutdown
                        
                    }
                }*/
            }
        };
    this.cache_data.step=(utils.obj_valid_key(opts,'step')?merge(true,step_defaults,opts.step):step_defaults);
    var offset_defaults={
            'size':1000,//page size
            //'size':5,//page size
            'inc':false//cursor position aka count or increment};
        };
    this.cache_data.offset=(utils.obj_valid_key(opts,'offset')?merge(true,offset_defaults,opts.offset):offset_defaults);//use this to manage how much CPU we are using in one cycle
	//plugin system
	this.plugin={//allows only for single functions
        'init':false,
        'pre_init':false,
        'set_cache':false,
        'get_cache':false,
        'populate_cache':false,
        'is_locked':false,
        'read_lock':false,
        'pre_set_lock':false,
        'set_lock':false,
        'pre_release_lock':false,
        'release_lock':false,
        'pre_step':false,
        'step':false
	};
    for(var k in this.plugin){
        if(utils.obj_valid_key(opts,'plugin') && utils.obj_valid_key(opts.plugin, k) && typeof(opts.plugin[k])==='function'){
            this.plugin[k]=opts.plugin[k];}}
	this.init();//start!
}
CronStep.prototype.init=function(){
	var self=this;
    
    self.cache_data.step.current=(self.cache_data.step.steps.length>0 && self.cache_data.step.current===false?0:self.cache_data.step.current);
    
	var log_path=self.doc_root+self.log_dir;
	if(!fs.existsSync(log_path)){fs.mkdirSync(log_path);}//create base cache dir
	
	///////\\\\\\\\\\PLUGIN HOOK pre_init\\\\\\\\/////////
	var _args={'log_path':log_path},//index keys mimic scope variables that should be passed
		key_list=utils.array_keys(_args),
		_vr='';
	self.i_callback('pre_init',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK pre_init\\\\\\\\/////////
    
	log_path=log_path+self.ident;
	if(!fs.existsSync(log_path)){fs.mkdirSync(log_path);}//create base instance dir
    log_path=log_path+'/';
    self.log_path=log_path;
    self.thread_ident='THR-'+(new Date().getTime().toString())+'-IDNT-'+self.ident.toString();//instance id
    self.o_lock.thread_ident=self.thread_ident;

console.log('============= CRONSTEP(init) THREAD IDENT: '+self.thread_ident+' =============');
//console.log("init!");
	var cached_data=false;
    if(self.set_lock()){//we have control!
//console.log("init set lock!");
        cached_data=self.get_cache();
//console.log("init cached_data: ",cached_data);
        if(cached_data){//retrieve the current data
            self.init_prop();//custom properties need to be added to cache_schema and cache_data
            self.populate_cache();}//repopulate cache_data
        self.step_advance();//check if we can abandon this step
        self.set_cache();//save the current cache_data
	
        ///////\\\\\\\\\\PLUGIN HOOK init\\\\\\\\/////////
        var _args={'cached_data':(cached_data!==false?true:false)},//index keys mimic scope variables that should be passed
            key_list=utils.array_keys(_args),
            _vr='';
        self.i_callback('init',_args);
        for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
        ///////\\\\\\\\\\END PLUGIN HOOK init\\\\\\\\/////////
    }
};
CronStep.prototype.i_callback=function(hookIn,argsIn){//internal callback - pluginable hooks
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
CronStep.prototype.set_cache=function(){//set cache from current whitelist of data
	var self=this,
        data=merge(true,{},self.cache_schema),
        write_log={'success':[],'fail':[]};
    
    if(self.is_locked()){self.log_lock_loss({'func':'set_cache'});return false;}//we don't own thread
    
    if(self.logger.success.length>0){write_log.success=self.logger.success.concat(write_log.success);}
    if(self.logger.fail.length>0){write_log.fail=self.logger.fail.concat(write_log.fail);}
    
    for(var k in data){
        if(utils.obj_valid_key(self.cache_data,k)){
            data[k]=(typeof(self.cache_data[k])==='object' && !(self.cache_data[k] instanceof Array)?merge(true,{},self.cache_data[k]):self.cache_data[k]);
        }
    }
    delete data.step.callback;
    //delete data.thread_ident;
    delete data.logger.success;
    delete data.logger.fail;
    
    self.cache_data.thread_ident=self.thread_ident;
    self.cache_data.ident=self.ident;
    data.logger.success_inc=data.logger.success_inc+write_log.success.length;
    data.logger.fail_inc=data.logger.fail_inc+write_log.fail.length;
	
	///////\\\\\\\\\\PLUGIN HOOK set_cache\\\\\\\\/////////
	var _args={'data':data,'write_log':write_log},//index keys mimic scope variables that should be passed
		key_list=utils.array_keys(_args),
		_vr='';
	self.i_callback('set_cache',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK set_cache\\\\\\\\/////////

    fs.writeFileSync(self.log_path + self.manifest_file, JSON.stringify(data));

    if(write_log.success.length>0 || write_log.fail.length>0){
        var file_inc=self.logger.file_inc,
            file_inc_max=self.logger.file_inc_max,
            file_alpha_inc=self.logger.file_alpha_inc,
            file_max=self.logger_max_size*1024,
            file_parse=function(inc,filePath){
                var file_inc_str=(inc>0?'-'+utils.zero_pad_front(inc, file_inc_max.toString().length):'');
                if(utils.basic_str(file_alpha_inc)){
                    file_inc_str='-'+file_alpha_inc+file_inc_str;}
                
                var ext=utils.get_ext(filePath),
                    file_base=(utils.basic_str(ext)?utils.check_strip_last(filePath,'.'+ext)+file_inc_str:file_inc_str+filePath),
                    file_path=self.log_path + file_base + (utils.basic_str(ext)?'.'+ext:'');
                return {'inc':inc,'ext':ext,'inc_str':file_inc_str,'base':file_base,'path':file_path};
        };
//console.log('========== CRON STEP writeFileSync B4');
        do{
            var file_str_obj=file_parse(file_inc,self.logger_file),
                curr_size=(fs.existsSync(file_str_obj.path)?fs.statSync(file_str_obj.path).size:0);
            if(curr_size>file_max){
                if((file_inc+1)>file_inc_max){
                    file_inc=1;
                    file_alpha_inc=(utils.basic_str(file_alpha_inc)?utils.alpha_num_inc(file_alpha_inc):'a');//introduce letters and increment them!
                }else{
                    file_inc++;
                }
                file_str_obj=file_parse(file_inc,self.logger_file);
            }else if(curr_size<file_max){
                fs.appendFileSync(file_str_obj.path, JSON.stringify(write_log)+"\n");
            }
        }while(!fs.existsSync(file_str_obj.path));//continue while true
//console.log('========== CRON STEP writeFileSync AF');
        var new_logger_data={
            'success_inc':data.logger.success_inc,
            'fail_inc':data.logger.fail_inc, 
            'file_inc':file_inc,
            'file_alpha_inc':file_alpha_inc
        };
        self.logger=merge(true,{},self.logger_schema,new_logger_data);//memeory optimization
    }

    return true;
};
CronStep.prototype.populate_cache=function(){//populate the object with the cached status
    var self=this;
    if(self.is_locked()){self.log_lock_loss({'func':'populate_cache'});return false;}//we don't own thread
    var file_data=self.get_cache(),
        data=merge(true,{},self.cache_schema);
	if(!file_data){return false;}
//console.log('======= CRONSTEP populate_cache - data',"\n",data);
    for(var k in data){
        if(k==='thread_ident'){continue;}//we do not inherit this one
        else if(k==='added_properties'){continue;}//we do not inherit this one
        if(utils.obj_valid_key(self.cache_data,k) && utils.obj_valid_key(data,k) && utils.obj_valid_key(file_data,k)){
//console.log(k,'b4',self.cache_data[k]);
            self.cache_data[k]=(typeof(file_data[k])==='object' && !(file_data[k] instanceof Array)?merge(true,{},self.cache_data[k],file_data[k]):file_data[k]);
//console.log(k,'af',self.cache_data[k]);
        }
    }
    self.ident=self.cache_data.ident;
//console.log('======= CRONSTEP self.cache_data.ident',self.cache_data.ident);
    
	///////\\\\\\\\\\PLUGIN HOOK populate_cache\\\\\\\\/////////
	var _args={'file_data':file_data},//index keys mimic scope variables that should be passed
		key_list=utils.array_keys(_args),
		_vr='';
	self.i_callback('populate_cache',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK populate_cache\\\\\\\\/////////
    
    return true;
};
CronStep.prototype.get_cache=function(){
	var self=this;
    if(self.is_locked()){self.log_lock_loss({'func':'get_cache'});return false;}//we don't own thread
    
    var file_data=(fs.existsSync(self.log_path + self.manifest_file)?fs.readFileSync(self.log_path + self.manifest_file).toString():false);
    if(file_data===false){return false;}
    
    file_data=JSON.parse(file_data);
    if(self.ident!==file_data.ident && file_data.ident!==false){return false;}
	
	///////\\\\\\\\\\PLUGIN HOOK get_cache\\\\\\\\/////////
	var _args={'file_data':file_data},//index keys mimic scope variables that should be passed
		key_list=utils.array_keys(_args),
		_vr='';
	self.i_callback('get_cache',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK get_cache\\\\\\\\/////////
    
    return file_data;
};
CronStep.prototype.log_lock_loss=function(contextObj){
    var self=this;
console.log("\n",'==-==-=-===-=-=- log_lock_loss ==-==-=-===-=-=-');
console.log(contextObj);
console.log('==-==-=-===-=-=- log_lock_loss ==-==-=-===-=-=-',"\n");
    var file_inc=0,
        file_inc_max=self.logger.file_inc_max,//borrow this var :D
        file_alpha_inc=0,
        file_max=self.logger_max_size*1024,
        file_parse=function(inc,filePath){
            var file_inc_str=(inc>0?'-'+utils.zero_pad_front(inc, file_inc_max.toString().length):'');
            if(utils.basic_str(file_alpha_inc)){
                file_inc_str='-'+file_alpha_inc+file_inc_str;}

            var ext=utils.get_ext(filePath),
                file_base=(utils.basic_str(ext)?utils.check_strip_last(filePath,'.'+ext)+file_inc_str:file_inc_str+filePath),
                file_path=self.log_path + file_base + (utils.basic_str(ext)?'.'+ext:'');
            return {'inc':inc,'ext':ext,'inc_str':file_inc_str,'base':file_base,'path':file_path};
    };
    do{
        var file_str_obj=file_parse(file_inc,self.lockloss_logger_file),
            curr_size=(fs.existsSync(file_str_obj.path)?fs.statSync(file_str_obj.path).size:0);
        if(curr_size>file_max){
            if((file_inc+1)>file_inc_max){
                file_inc=1;
                file_alpha_inc=(utils.basic_str(file_alpha_inc)?utils.alpha_num_inc(file_alpha_inc):'a');//introduce letters and increment them!
            }else{
                file_inc++;
            }
            file_str_obj=file_parse(file_inc,self.lockloss_logger_file);
        }else if(curr_size<file_max){
            var data=merge(true,{},self.cache_schema);//miminc set_data()
            for(var k in data){
                if(utils.obj_valid_key(self.cache_data,k)){
                    data[k]=(typeof(self.cache_data[k])==='object' && !(self.cache_data[k] instanceof Array)?merge(true,{},self.cache_data[k]):self.cache_data[k]);
                }
            }
            delete data.step.callback;
            fs.appendFileSync(file_str_obj.path, JSON.stringify({'context':contextObj,'logger':self.logger,'cache_data':self.data,'o_lock':self.o_lock})+"\n");
        }
    }while(!fs.existsSync(file_str_obj.path));//continue while true
};
CronStep.prototype.is_locked=function(reasonArr){
	var self=this,
        reasonArr=(typeof(reasonArr)==='object' && reasonArr.length>0?reasonArr:[]),
        read_data=self.read_lock(),
        result=true,
        reason_val='';
   
    if(read_data.thread_ident===false){//this thread has been signed in
        reason_val='takeover_safe';
        result=false;
    }else if(read_data.thread_ident===self.thread_ident){//this thread! we can write it!
        reason_val='takeover_self';
        result=false;
    }
    if(reason_val.length===0){reason_val='failed';}
	
	///////\\\\\\\\\\PLUGIN HOOK is_locked\\\\\\\\/////////
	var _args={'result':result,'reason_val':reason_val},//index keys mimic scope variables that should be passed
		key_list=utils.array_keys(_args),
		_vr='';
	self.i_callback('is_locked',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK is_locked\\\\\\\\/////////
    
    reasonArr.push({'reason':reason_val,'stamp':(new Date).toISOString().replace(/z|t/gi,' ')});
    return result;
};
CronStep.prototype.read_lock=function(){
//console.log('fs.existsSync(this.log_path + this.lock_file)',fs.existsSync(this.log_path + this.lock_file));
	var self=this,
        file_data=(fs.existsSync(self.log_path + self.lock_file)?fs.readFileSync(self.log_path + self.lock_file).toString():false);

    if(!file_data){file_data=merge(true,{},self.lock_schema);}
    file_data=(typeof(file_data)==='string'?JSON.parse(file_data):file_data);
	
	///////\\\\\\\\\\PLUGIN HOOK read_lock\\\\\\\\/////////
	var _args={'file_data':file_data},//index keys mimic scope variables that should be passed
		key_list=utils.array_keys(_args),
		_vr='';
	self.i_callback('read_lock',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK read_lock\\\\\\\\/////////
    
    return file_data;
};
CronStep.prototype.set_lock=function(){
	var self=this,
        data=merge(true,{},self.lock_schema),
        takeover_hist=[],
        can_write=false;

    if(!fs.existsSync(self.log_path)){return false;}//something wrong after init(); -> most likely a reset();
    if(!fs.existsSync(self.log_path + self.lock_file)){//no file?! We're new!
        takeover_hist.push({'reason':'new','stamp':(new Date).toISOString().replace(/z|t/gi,' ')});
        can_write=true;
    }else{
        var read_data=self.read_lock(),
            tmp_hist=[],
            did_timeout=false;
        takeover_hist=read_data.takeover_hist;//logging forward
        if(!self.is_locked(tmp_hist)){//this thread has been signed in
            can_write=true;
        }else if(new Date().getTime()>=(read_data.last_lock+(read_data.lock_timeout*1000))){//something went wrong. Release the lock and take it over
            did_timeout=true;
        }
        //clean up log clutter
        if(
            can_write && (//if we're writing it came from the first if and thats what needs cleaning
                (self.cache_data.offset.inc!==false && tmp_hist.length>0 && tmp_hist[takeover_hist.length-1].reason==='takeover_self') || //only note this if its the first takeover
                (tmp_hist.length>0 && tmp_hist[tmp_hist.length-1].reason==='failed')//fails create clutter
            )
        ){
            tmp_hist.pop();}
        takeover_hist=takeover_hist.concat(tmp_hist);
        // \\clean up log clutter
        if(did_timeout){
            takeover_hist.push({'reason':'takeover_timeout','stamp':(new Date).toISOString().replace(/z|t/gi,' ')});
            can_write=true;
        }
    }
	
	///////\\\\\\\\\\PLUGIN HOOK pre_set_lock\\\\\\\\/////////
	var _args={'can_write':can_write,'takeover_hist':takeover_hist,'data':data},//index keys mimic scope variables that should be passed
		key_list=utils.array_keys(_args),
		_vr='';
	self.i_callback('pre_set_lock',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK pre_set_lock\\\\\\\\/////////
    
    if(can_write){
        for(var k in data){
            if(utils.obj_valid_key(self.o_lock,k)){
                data[k]=(typeof(self.o_lock[k])==='object' && !(self.o_lock[k] instanceof Array)?merge(true,{},self.o_lock[k]):self.o_lock[k]);//if its an object it needs to be broken from its Pass By Reference
        }}
        data.last_lock=new Date().getTime();
        data.takeover_hist=takeover_hist;//loggin only
	
        ///////\\\\\\\\\\PLUGIN HOOK set_lock\\\\\\\\/////////
        var _args={'data':data},//index keys mimic scope variables that should be passed
            key_list=utils.array_keys(_args),
            _vr='';
        self.i_callback('set_lock',_args);
        for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
        ///////\\\\\\\\\\END PLUGIN HOOK set_lock\\\\\\\\/////////

        fs.writeFileSync(self.log_path + self.lock_file, JSON.stringify(data));
//console.log("WRITE data",data);
        return true;
    }
    return false;
};
CronStep.prototype.release_lock=function(){
	var self=this,
        can_release=false;

    if(!fs.existsSync(self.log_path)){return false;}//something wrong after init(); -> most likely a reset();
    if(!fs.existsSync(self.log_path + self.lock_file)){//no file?! Something is wrong :/ - return true so a new one can be set
        self.set_lock();//create the file
        can_release=true;}

    var read_data=self.read_lock();
    if(read_data.thread_ident===self.thread_ident){//this thread! we can release it!
        can_release=true;}
	
	///////\\\\\\\\\\PLUGIN HOOK pre_release_lock\\\\\\\\/////////
	var _args={'can_release':can_release,'read_data':read_data},//index keys mimic scope variables that should be passed
		key_list=utils.array_keys(_args),
		_vr='';
	self.i_callback('pre_release_lock',_args);
	for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
	///////\\\\\\\\\\END PLUGIN HOOK pre_release_lock\\\\\\\\/////////
    
    if(can_release){
        read_data.last_lock=new Date().getTime();
        read_data.thread_ident=false;//signout thread
//console.log("WRITE (RELEASE) read_data",read_data);

        ///////\\\\\\\\\\PLUGIN HOOK release_lock\\\\\\\\/////////
        var _args={'read_data':read_data},//index keys mimic scope variables that should be passed
            key_list=utils.array_keys(_args),
            _vr='';
        self.i_callback('release_lock',_args);
        for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
        ///////\\\\\\\\\\END PLUGIN HOOK release_lock\\\\\\\\/////////

        fs.writeFileSync(self.log_path + self.lock_file, JSON.stringify(read_data));
    }
    
    return can_release;
};
CronStep.prototype.init_prop=function(){
	var self=this;
    if(self.is_locked()){self.log_lock_loss({'func':'init_prop'});return false;}//we don't own thread
    
    var file_data=self.get_cache();
    if(file_data===false){return false;}

    self.cache_data.added_properties=_.uniq(self.cache_data.added_properties.concat(file_data.added_properties));
    var new_dex=utils.array_redex(self.cache_data.added_properties);
    if(new_dex===false){new_dex=[];}
    self.cache_data.added_properties=new_dex.concat([]);//break reference object - because we delete below
    delete new_dex;
    
    if(self.cache_data.added_properties.length>0){
        for(var i=0;i<self.cache_data.added_properties.length;i++){
            self.add_prop(self.cache_data.added_properties[i].key_id,self.cache_data.added_properties[i].default_val);
        }
    }
};
CronStep.prototype.add_prop=function(keyIn, defaultVal){//adds to cache schema and populates defaults
	var self=this;
    if(self.is_locked()){self.log_lock_loss({'func':'add_prop','args':arguments});return false;}//we don't own thread
    
    if(_.indexOf(self.cache_key_blacklist,keyIn)!==-1 || utils.obj_valid_key(self.cache_data,keyIn)){return false;}//black list or existing

    self.cache_schema[keyIn]=((typeof(defaultVal)==='object' && !(defaultVal instanceof Array))?merge(true,{},defaultVal):defaultVal);
    if(typeof(defaultVal)==='object' && defaultVal instanceof Array){
        self.cache_schema[keyIn]=defaultVal.concat([]);}
    
    if(utils.array_object_search(self.cache_data.added_properties,'key_id',keyIn).length===0){
        var out_obj={'key_id':keyIn,'default_val':((typeof(defaultVal)==='object' && !(defaultVal instanceof Array))?merge(true,{},defaultVal):defaultVal)};

        if(typeof(defaultVal)==='object' && defaultVal instanceof Array){
            out_obj.default_val=defaultVal.concat([]);}
        self.cache_data.added_properties.push(out_obj);
    }
    self.set_prop(keyIn,defaultVal);
    return true;
};
CronStep.prototype.set_prop=function(keyIn, setVal){
	var self=this;
    if(self.is_locked()){self.log_lock_loss({'func':'set_prop','args':arguments});return false;}//we don't own thread
    
    if(_.indexOf(self.cache_key_blacklist,keyIn)!==-1 || !utils.obj_valid_key(self.cache_schema,keyIn) || utils.array_object_search(self.cache_data.added_properties,'key_id',keyIn).length===0){return false;}//black list or not existing schema or added properly into added_properties
    self.cache_data[keyIn]=(typeof(setVal)==='object' && !(setVal instanceof Array)?merge(true,{},setVal):setVal);
    if(typeof(setVal)==='object' && setVal instanceof Array){
        self.cache_data[keyIn]=setVal.concat([]);}
    
    return true;
};
CronStep.prototype.init_step=function(){
	var self=this;
    if(self.is_locked()){self.log_lock_loss({'func':'init_step'});return false;}//we don't own thread
    return (!self.is_step?self.step():false);
};
CronStep.prototype.step=function(){
	var self=this;
    if(self.is_locked()){self.log_lock_loss({'func':'step_1'});return false;}//we don't own thread
    if(!self.is_step){
        var fire_init=(self.thread_inc===0 && !self.is_step?true:false);
        self.cache_data.offset.inc=(self.cache_data.offset.inc===false?0:self.cache_data.offset.inc);
        self.cache_data.step.inc=(self.cache_data.step.inc===false?0:self.cache_data.step.inc);
        self.exc_start_time=(self.exc_start_time===false?new Date().getTime():self.exc_start_time);
        self.is_step=true;
        
        var curr_step_key=self.current_step_key(),
            do_step_loop_func=function(){//some sort of faux loop
                if(self.is_locked()){//we don't own thread - if this one happens its a big problem
                    self.log_lock_loss({'func':'do_step_loop_func'});
                    self_kill('lock_loss');
                    return false;
                }

                var start_sync_func=false;
                if(fire_init && utils.obj_valid_key(self.cache_data.step.callback, curr_step_key) && typeof(self.cache_data.step.callback[ (curr_step_key) ].start)==='function'){
                    var args={'start_sync_func':start_sync_func};// scope pass thru
                    self.cache_data.step.callback[ (curr_step_key) ].start.apply(self,[args,do_step_start_func]);
                    start_sync_func=args.start_sync_func;

                    if(typeof(start_sync_func)!=='function' && typeof(do_step_start_func)==='function'){//default usage
                        do_step_start_func();}
                    else if(typeof(start_sync_func)==='function' && typeof(do_step_start_func)==='function'){//async method
                        start_sync_func.apply(self,[do_step_start_func]);}
                    else{//break and treat like an error
                        self_kill('no_step_start_func_func_callback');}
                }else{
                    do_step_start_func();}
            },
            do_step_start_func=function(){
                var faux_log={'log_data':{}},//weird hack to do pass by reference
                    step_resolve_func=function(stepRes){
//console.log('step_resolve_func('+typeof(stepRes)+') ');
                        if(stepRes===true || stepRes===false){
                            var log_data=faux_log.log_data,
                                step_result=stepRes;

                            ///////\\\\\\\\\\PLUGIN HOOK pre_step\\\\\\\\/////////
                            var _args={'step_result':step_result, 'log_data':log_data},//index keys mimic scope variables that should be passed
                                key_list=utils.array_keys(_args),
                                _vr='';
                            self.i_callback('pre_step',_args);
                            for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
                            ///////\\\\\\\\\\END PLUGIN HOOK pre_step\\\\\\\\/////////

                            if(step_result===true){self.logger.success.push({'offset_inc':self.cache_data.offset.inc,'step_inc':self.cache_data.step.inc,'log_data':log_data,'timestamp':new Date().getTime()});}
                            else{self.logger.fail.push({'offset_inc':self.cache_data.offset.inc,'step_inc':self.cache_data.step.inc,'log_data':log_data,'timestamp':new Date().getTime()});}

                            self.thread_advance();//increment the thread numbers ++ (+1) and save it

                            var sync_func=false,
                                next_func=function(){//error or call next
//console.log("\n\n==========STEP SYNC CALLBACK (next_func) ===========");
                                    if(self.cache_data.offset.inc>=self.cache_data.offset.size){//shut down! due to over step of time or records
                                        self_kill('offset_inc_max_size');}
                                    else if(self.exc_time_exceeded()){//shut down! due to over step of time or records
                                        self_kill('exec_time');}
                                    else{
console.log("\n\n\t==========STEP SYNC CONTINUE ===========\n\n");
                                        process.nextTick(function(){
                                            self.step_timeout_id=setTimeout(do_step_loop_func,self.step_timeout_time);//self reference - delay start - next step!
                                        });
                                    }
                                        
                                };
                                
                            ///////\\\\\\\\\\PLUGIN HOOK step\\\\\\\\/////////
                            var _args={'next_func':next_func,'sync_func':sync_func},//index keys mimic scope variables that should be passed
                                key_list=utils.array_keys(_args),
                                _vr='';
                            self.i_callback('step',_args);
                            for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
                            ///////\\\\\\\\\\END PLUGIN HOOK step\\\\\\\\/////////

                            if(typeof(sync_func)!=='function' && typeof(next_func)==='function'){//default usage
                                next_func();}
                            else if(typeof(sync_func)==='function' && typeof(next_func)==='function'){//async method
                                sync_func.apply(self,[next_func]);}
                            else{//break and treat like an error
                                self_kill('no_next_func_callback');}
                        }
                    };// \\ step_resolve_func
                // do declared action set
                var step_func_res=null,
                    step_resolve_sync_func=false;
                if(utils.obj_valid_key(self.cache_data.step.callback, curr_step_key) && typeof(self.cache_data.step.callback[ (curr_step_key) ].action)==='function'){
                    var args={'log_data':faux_log.log_data, 'step_func_res':step_func_res, 'step_resolve_sync_func':step_resolve_sync_func};// scope pass thru
                    self.cache_data.step.callback[ (curr_step_key) ].action.apply(self,[args,step_resolve_func]);
                    
                    step_func_res=args.step_func_res;
                    step_resolve_sync_func=args.step_resolve_sync_func;
                    faux_log.log_data=args.log_data;// \\scope pass thru
                }
                // \\do declared action set

                if(typeof(step_resolve_sync_func)!=='function' && typeof(step_resolve_func)==='function'){//default usage
                    step_resolve_func(step_resolve_func);}
                else if(typeof(step_resolve_sync_func)==='function' && typeof(step_resolve_func)==='function'){//async method
                    var args={'log_data':faux_log.log_data};// scope pass thru
                    step_resolve_sync_func.apply(self,[args,step_resolve_func]);
                }else{//break and treat like an error
                    self_kill('no_action_callback');}
        },
        self_kill=function(reasonIdent){//written into a function because I think it will need an extra if below
            if(self.step_timeout_id!==false){clearTimeout(self.step_timeout_id);}
            self.step_timeout_id=false;
            if(utils.obj_valid_key(self.cache_data.step.callback, curr_step_key) && typeof(self.cache_data.step.callback[ (curr_step_key) ].end)==='function'){
                self.cache_data.step.callback[ (curr_step_key) ].end.apply(self,[{'reason_ident':reasonIdent}]);}
            self.is_step=false;
            self.thread_inc=0;
            self.release_lock();
            //if(self.cache_data.offset.inc>=self.cache_data.offset.size){
            if(reasonIdent==='offset_inc_max_size'){
                self.cache_data.offset.inc=false;//flag for resetting offset count otherwise pickup the offset point
                self.set_cache();
            }
        };
        
        do_step_loop_func();//next step!
        return true;
    }
    return false;
};
CronStep.prototype.thread_advance=function(){
	var self=this;
    if(self.is_locked()){self.log_lock_loss({'func':'thread_advance'});return false;}//we don't own thread
    if(!self.is_step){return false;}
    
    self.thread_inc++;
    self.cache_data.offset.inc++;
    self.cache_data.step.inc++;
    self.set_cache();
    
    return true;
};
CronStep.prototype.step_advance=function(){
	var self=this,
        did_advance=false;
    if(!self.is_locked()){
        var curr_step_key=self.current_step_key();
        if(typeof(curr_step_key)==='string' && utils.obj_valid_key(self.cache_data.step.callback, curr_step_key) && typeof(self.cache_data.step.callback[curr_step_key].next_step)==='function'){//onshutdown
            did_advance=self.cache_data.step.callback[curr_step_key].next_step.apply(self,[{}]);}
    }
    return did_advance===true?did_advance:false;
};
CronStep.prototype.current_step_key=function(){
	var self=this;
    if(self.cache_data.step.current!==false && typeof(self.cache_data.step.steps[self.cache_data.step.current])==='string'){
        return self.cache_data.step.steps[self.cache_data.step.current];}
    return false;
};
CronStep.prototype.exc_time_exceeded=function(){
	var self=this;
    if(self.exceed_time!==false && (new Date().getTime())>=(self.exc_start_time+(self.exceed_time*1000))){
console.log("\n",'========================= exc_time_exceeded =========================');
console.log("\t========================= DIF IF: ",(new Date().getTime())-(self.exc_start_time+(self.exceed_time*1000)),' =========================');
console.log("\t========================= DIFF ("+new Date().getTime()+")-("+self.exc_start_time+"): ",(new Date().getTime())-(self.exc_start_time),' =========================');
console.log('=====================================================================',"\n");


        return true;}
    return false;
};
CronStep.prototype.reset=function(){
	var self=this;
    self.terminate();//we want a proper shutdown
//console.log("CRON RESET self.log_path",self.log_path);
    utils.delete_dir_all(fs, self.log_path);
};
CronStep.prototype.terminate=function(){
	var self=this;
console.log('============= CRONSTEP(terminate) THREAD IDENT: '+self.thread_ident+' =============');
    if(self.step_timeout_id!==false){clearTimeout(self.step_timeout_id);}
    self.release_lock();
    var curr_step_key=self.current_step_key();
    if(typeof(curr_step_key)==='string' && utils.obj_valid_key(self.cache_data.step.callback, curr_step_key) && typeof(self.cache_data.step.callback[ (curr_step_key) ].terminate)==='function'){//onshutdown
        self.cache_data.step.callback[ (curr_step_key) ].terminate.apply(self,[{}]);}
    
};
return CronStep;

}