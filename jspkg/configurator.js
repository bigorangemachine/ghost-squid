
module.exports = function(process, fs, _, utils, root_params, version_obj){
    root_params.cmd=process.argv[0]; //info!
    root_params.path=process.argv[1];
    
    var _ex=root_params.path.split('/');
    root_params.doc_root=_ex.slice(0,_ex.length-1).join('/')+'/';
    delete _ex;
//console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!! CONFIGURATOR SETTING DOC_ROOT - '+root_params.doc_root + ' - !!!!!!!!!!!!!!!!!!!!!!!!!!!!');

    if(process.argv.length>2){//process node args - first 2 are always ['node', 'thefile-in-this-case-main.js'] 
        var arg_error=false,
            base_wrap=['"','\''],
            base_sep='=',
            all_seps=[base_sep],
            cust_args=[//.arg and .var_set are required!
                {'arg':'config','var_set':'root_params.config','split':base_sep,'wrap':base_wrap, 'type':'string'},
                {'arg':'version-id','var_set':'version_obj.id','split':base_sep,'wrap':base_wrap, 'type':'int'},
                {'arg':'time-window','var_set':'root_params.cron_window','split':base_sep,'wrap':base_wrap, 'type':'int'},
                {'arg':'-ident','var_set':'cron_ident','split':base_sep,'wrap':base_wrap},
                {'arg':'-silent','var_set':'root_params.silent'},
                {'arg':'--reset','var_set':'root_params.do_reset'},
                {'arg':'--post-install','var_set':'root_params.do_postinstall'}
            ],
            base_arg_func=function(strIn){
                var found=false;
                for(var a=0;a<cust_args.length;a++){
                    if(strIn.indexOf(cust_args[a].arg)===0){//starts with the arg!
                        if(utils.obj_valid_key(cust_args[a],'split')){//has a split!
                            var sep_pos=strIn.indexOf(cust_args[a].split),// - expecting arg= or arg =
                                _arg=strIn.substring(0,(sep_pos>0?sep_pos:0));//creates empty string  if not found
                            if(utils.basic_str(_arg) && strIn.trim()===_arg.trim()){found=a;break;}
                        }
                        if(utils.basic_str(cust_args[a].arg) && strIn.trim()===cust_args[a].arg.trim()){found=a;break;}
                    }
                }
                if(found!==false){return cust_args[found].arg;}//white list test


                for(var a=0;a<all_seps.length;a++){
                    var sep_pos=strIn.indexOf(all_seps[a]),// - expecting arg= or arg =
                        _arg=strIn.substring(0,(sep_pos>0?sep_pos:0));//creates empty string  if not found
                    if(utils.basic_str(_arg)){//something exists
                        var _ex=strIn.split(all_seps[a]);
                        if(_ex.length>0 && utils.basic_str(_ex[0])){return _ex[0].trim();}
                    }
                }
                return strIn;

            };
        // seperator cleaning
        for(var a=0;a<cust_args.length;a++){
            if(utils.obj_valid_key(cust_args[a],'split') && _.indexOf(all_seps, cust_args[a].split)===-1){
                all_seps.push(cust_args[a].split);}}
        _.sortBy(all_seps, function(v){return v.toString().length;});
        all_seps.reverse();
        // \\seperator cleaning

        for(var p=2;p<process.argv.length;p++){//first 2 are always ['node', 'thefile-in-this-case-main.js']
            var base_arg_str=base_arg_func(process.argv[p]),
                seek=utils.array_object_search(cust_args,'arg',base_arg_str),
                allow_change=false;
//console.log('p: ',p,' --- ',process.argv[p], ' - seek: ',seek,"eval('typeof(+seek[0].var_set)')",(seek.length>0?eval('typeof('+seek[0].var_set+')'):''));
            if(seek.length>0 && eval('typeof('+seek[0].var_set+')')!=='undefined'){
                var val=true;
                if(utils.obj_valid_key(seek[0],'split') && utils.basic_str(seek[0].split) && process.argv[p].indexOf(seek[0].split)!==-1){
                    var _ex=process.argv[p].split(seek[0].split);
                        val=_ex.slice(1,_ex.length).join(seek[0].split);
                    //hey actually unix takes care of this!
                    if(utils.obj_valid_key(seek[0],'wrap') && seek[0].wrap.length>0){//has wrap
                        for(var w=0;w<seek[0].wrap.length;w++){//cleaning the wrappers
                            if(val.indexOf(seek[0].wrap[w])!==-1 && val.lastIndexOf(seek[0].wrap[w],val.length-1)!==-1){//wrapper!
                                var tmp=utils.check_strip_last(utils.check_strip_first(val, seek[0].wrap[w]), seek[0].wrap[w]);
                                if(utils.basic_str(tmp)){val=tmp;break;}//wrappers found so we're done
                            }
                        }
                    }
                }
                val=(val.toString().toLowerCase()==='false'?false:val);
                val=(val.toString().toLowerCase()==='true'?true:val);
//console.log("VAL",val,"\nCHECK",((val===false || utils.basic_str(val)?'TRUE':'FALSE')));
                val=(val===false || utils.basic_str(val)?val:true);
                
                if(typeof(val)!=='undefined'){//nothing weird happened
//console.log("typeof(val)!=='undefined'");
                    var eval_val=eval(seek[0].var_set);
                    if((eval('typeof('+seek[0].var_set+')')==='boolean' && typeof(val)==='boolean')){//if true before the value should be boolean
                        allow_change=true;}
                    else if((eval_val===false && typeof(val)!=='boolean')){//false is a default to me
                        allow_change=true;}
                    else if(utils.is_scalar(eval_val) && utils.is_scalar(val) && utils.obj_valid_key(seek[0],'type')){//matched data tyeps should be allowed to write-over a type must be specified
                        allow_change=true;}
                }
                if(allow_change){
//console.log(seek[0].var_set,' val ['+typeof(val)+'] ', (val===true?'TRUE':val), (utils.basic_str(val)?'TRUE':'FALSE'));
                    if(utils.obj_valid_key(seek[0],'type')){
                        if(seek[0].type.toLowerCase()==='int'){val=parseInt(val);}
                        else if(seek[0].type.toLowerCase()==='float' || seek[0].type.toLowerCase()==='double'){val=parseFloat(val);}
                        else if(seek[0].type.toLowerCase()==='number'){val=Number(val);}
                    }
                    root_params.found_params.push({'arg':base_arg_str,'val':val});
                    eval(''+seek[0].var_set+'= val;');}
            }
            if(!allow_change){
                arg_error=true;
                console.warn("ARGUMENT ERROR ",process.argv[p],' - (',base_arg_func(process.argv[p]),')');}
        }
        if(arg_error){process.exit();}
    }
//console.log('root_params.found_params',root_params.found_params);

    if(!root_params.silent){
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!! CONFIGURATOR - PID: '+process.pid+' USER: '+process.env['USER'] +' in '+root_params.doc_root + ' !!!!!!!!!!!!!!!!!!!!!!!!!!!!');}
    
    try{
        var path_prefix='',
            load_path=root_params.config;
        if(load_path.indexOf('./')===0){
            path_prefix='../';
            load_path=utils.check_strip_first(load_path,'./');
        }else if(load_path.indexOf('/')!==0){//if it starts with '/' its very specific - full path provided - no correction needed
            path_prefix='../';
        }
        load_path=utils.check_strip_last(load_path, '.js');
        var _args=utils.array_object_search(root_params.found_params, 'arg', 'config');
        if(!root_params.silent && _args.length>0){//if a config path was provided through an argument... show this message
            console.log('Loading Config \''+path_prefix + _args[0].val+'\': ');
            console.log("path_prefix + utils.check_strip_last(load_path,'.js')+'.js': ",fs.realpathSync(utils.check_strip_last(load_path,'.js')+'.js'));//weird bug fs works from where the script starts I guess?
        }

        var config=require(path_prefix + load_path);
        if(config.doc_root && typeof(config.doc_root)==='string'){root_params.doc_root=config.doc_root;delete config.doc_root;}

    }catch(e){
        console.error('CONFIGURATOR BAD CONFIG PATH: \''+root_params.config+'\' ');
        if(!root_params.silent){console.log('[ERROR]: ',e.toString());}
        process.exit();
    }
    return config;
};