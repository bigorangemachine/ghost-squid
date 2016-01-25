/*
Note the comment '//#customAdjustment' are suggested custom adjustments
 */
module.exports = function(rootManifest, opts){
    //transfer the variable names
    var process=rootManifest.process,
        _=rootManifest['_'],
        url=rootManifest.url,
        JSON=rootManifest.JSON,
        md5=rootManifest.md5,
        fs=rootManifest.fs,
        merge=rootManifest.merge,
        cheerio=rootManifest.cheerio,
        utils=rootManifest.utils,
        phrowser_obj=rootManifest.phrowser_obj,
        indexer_DB_obj=rootManifest.indexer_DB_obj,
        cacher_obj=rootManifest.cacher_obj,
        terminate_manifest=rootManifest.terminate_manifest,
        do_terminate=rootManifest.do_terminate,
        base_step_settings=rootManifest.base_step_settings,
        version_obj=rootManifest.version_obj,
        scraper_obj=rootManifest.scraper_obj;
    // \\ transfer the variable names
    
    //extendable variables/settings
    var cache_path=(utils.obj_valid_key(opts, 'cache_path')?opts.cache_path:'_cache/files/');
    
    //init!
    if(!fs.existsSync(cache_path)){fs.mkdirSync(doc_root + cache_path);}//create base cache dir
    // \\ init!


    // \\ extendable variables/settings
    
    //local varaibles
    var my_foo=false;//#customAdjustment
    // \\ local varaibles
    
    //the goods!
    var manifest={
        'next_step':function(pkg){//test if we can abandon this step - true or false - init() triggered only done on start

        },
        'start':function(pkg){//onstart/onready of the step cycle
            var self_cron=this;//cron_data_obj aka new CronStep
            
            //for async - nonblocking
            pkg.start_sync_func=function(callback){//we're indicating we want we are doing an async callback by populating this variable
                var curr_step_key=self_cron.current_step_key();
                if((curr_step_key===false || curr_step_key==='base')){//#customAdjustment - any first-step in multi-step should have this if statement
                    //do STUFF!
                    if(typeof(callback)==='function'){callback();}
                }
            };
            /*
            //for sync - blocking
            var curr_step_key=self_cron.current_step_key();
            if((curr_step_key===false || curr_step_key==='base')){//#customAdjustment - any first-step in multi-step should have this if statement
                //do whatever :D
            }
            */
        },
        'action':function(pkgRoot,next){//what is our active part
            //pkgRoot.log_data['baz']='Lipsum';//append the log this way!
            var self_cron=this;//cron_data_obj aka new CronStep
            var scrape_return=scraper_obj.capture_uri_test(self_cron.cache_data.crawl_target.url);
            if(scrape_return===false){return false;}
            pkgRoot.step_resolve_sync_func=function(pkg){//passed up function
                // write data setup
                var write_success=false,
                    write_action=function(){
                        next(write_success);
                    },
                    curr_cache_file=false,
                    _curr_method=self_cron.cache_data.crawl_target.method.toUpperCase(),
                    curr_method=(_curr_method==='POST' || _curr_method==='GET'?_curr_method:'GET'),
                    curr_url=self_cron.cache_data.crawl_target.url;
                // \\ write data setup
                var did_existing_sql=false,
                    did_existing_fuc=function(evType){//2nd arg is 'result response' object
                        if(did_existing_sql===false && (evType==='result' || evType==='end' || evType==='error')){// did_existing_sql
console.log("\n", "=============== did_existing_fuc(" + 'evType ', evType + " LEN: "+arguments.length+") ===============","\n");
                            did_existing_sql=true;
                            
                            if(evType==='error' && arguments.length>1){//2rd arg is error message
                                pkg.log_data['sql_error']=arguments[2].message;
                                write_action();
                                return;//end here
                            }else if(evType==='result' && arguments.length>1){//3rd arg is result obj
                                var q_data=arguments[2];
                                pkg.log_data['message']='Exisiting Instance Found: ';
                                if(utils.obj_valid_key(q_data, 'id')){pkg.log_data['message']=pkg.log_data['message'] + ' ID: ' + q_data.id;}
                                else{pkg.log_data['message']=pkg.log_data['message'] + 'JSON:|'+ JSON.stringify(q_data)+'|';}
                                pkg.log_data['message']=pkg.log_data['message']+'. ' + 'URL: '+curr_url;

                                write_action();
                                return;
                            }else if(evType==='end'){
                                write_action();
                                return;//end here
                            }
                            
                        }
                        // \\ did_existing_sql
                    },
                    view_data_obj={'version_id':version_obj.id,'url':curr_url};
                indexer_DB_obj.view_instance(view_data_obj, did_existing_fuc); //,'response_code':indexer_DB_obj.response_codes['null'].code

            };// \\ passed up function
        },
        'terminate':function(pkg){//onshutdown

        }
    };
    var step_action=function(pkg){
        var _found_data=false,
            _completed=false;
        //pkg.allow_next=false;//indicate we are using async
        pkg.sync_func=function(do_next){
            var self_cron=this,//cron_data_obj aka new CronStep
                view_data_obj={
                    'id':null,
                    'url':null,
                    'method':null,
                    'cookie_vars':null,
                    'referer_header':null,
                    'response_code':null,
                    'limit':{'pos':self_cron.cache_data.step.inc, 'row_count':1}
                },
                result_func=function(evType){
                if(_completed===false && (evType==='result' || evType==='end' || evType==='error')){
                    _completed=true;
//console.log('=================== evType ',evType,"\n\t",arguments[1],"\n\t",arguments[2]);
                    if(evType==='result'){
                        var q_data=arguments[2];
                        if(utils.obj_valid_key(q_data, 'url')){//if data is good!
                            _found_data=true;

console.log('======================= DATABASE AF POPULATE: ');
                            self_cron.cache_data.crawl_target.url_source_id=q_data.id;
                            self_cron.set_cache();//save what we set
                        }
                    }
                    if(evType==='result' || evType==='error'){//something is wrong.  Lets continue
                        do_next();
                    }else if(_found_data===false && evType==='end'){//we're probably done
                        do_terminate();
                    }
                }
            };
            //view_data_obj.order_by=date_created ASC, id ASC';//pi doesn't like this?! - causes skipped records for some-reason mysql bug!?
//console.log('================= view_data_obj: ',view_data_obj);
            var view_res=indexer_DB_obj.view_instance(view_data_obj, result_func);//,true to enable sql debug
            if(view_res===false){//something is likely wrong
                do_terminate();}
        }
    };
    var init_action=function(){
        var self_cron=this;//cron_data_obj aka new CronStep
        if(!self_cron.init_step()){//this starts the crop stepping.  false means failure. shut it down
            do_terminate();}

        if(version_obj.id!==false && !utils.obj_valid_key(self_cron.cache_data,'version_id')){//inidcator the custom data hasn't been set
console.log("====== init props! ======");
            self_cron.add_prop('version_id',false);//specify the default
            self_cron.add_prop('crawl_target',{'url':base_step_settings.init_url,'referer':'','method':base_step_settings.init_method,'url_source_id':base_step_settings.url_source_id, 'cookie_vars':base_step_settings.cookie_vars});

            self_cron.set_prop('version_id',version_obj.id);//specify the value
            self_cron.set_prop('crawl_target',{'url':base_step_settings.init_url,'referer':'','method':base_step_settings.init_method,'url_source_id':base_step_settings.url_source_id, 'cookie_vars':base_step_settings.cookie_vars});
console.log("=========================", self_cron.cache_data,"\n\t","");
            self_cron.set_cache();//save what we set
console.log("====== \\\\ init props! ======");
        } 
    };
    return {'manifest':manifest,'init_action':init_action,'step_action':step_action};
};