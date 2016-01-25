
var cheerio = require('cheerio'),//https://github.com/cheeriojs/cheerio
    _ = require('underscore'),//http://underscorejs.org/
    merge = require('merge'),//allows deep merge of objects
    mysql = require('mysql'),//https://github.com/felixge/node-mysql/
    phantom = require('phantom'),//https://github.com/sgentle/phantomjs-node
    fs = require('fs'),
    url = require('url'),
    querystring = require('querystring'),
    assert = require('assert'),
    md5 = require('MD5'),
    repeat = require('string.prototype.repeat'),//FOR EASY DEBUGGING :D
    JSON = require('JSON');
    
var Cacher = require('./jspkg/cacher'),
	//baseDemo = require('./jspkg/baseDemo'),
	Phrowser = require('./jspkg/phrowser'),
	indexerDB = require('./jspkg/indexerDB'),
	scrapeURLer = require('./jspkg/scrapeURLer'),
	utils = require('./jspkg/utils'),
    vars = require('./jspkg/vars'),
	CronStep = require('./jspkg/cronStep')(fs, utils, _, merge),
    versionID = require('./jspkg/versionID')(utils);
var terminate_manifest=[], // {'obj_this': obj, 'func': 'func_name', 'args': [] } -> might need , 'sync_next': function(){}, 'next_arg': [null, null,{'next':true}, null]
    do_terminate=function(reportTrace){
        if(terminate_manifest.length>0){
            for(var t=0;t<terminate_manifest.length;t++){
                var task=terminate_manifest[t],
                    args=(typeof(task.args)==='object' && task.args.length>0?task.args:[]),
                    new_func=false,
                    valid_obj_prop=(utils.obj_valid_key(task,'obj_this') && typeof(task.obj_this)==='object'?true:false);
            
                if(valid_obj_prop && utils.obj_valid_key(task,'func') && typeof(task.func)==='string' && typeof(task.obj_this[task.func])==='function'){
                    new_func=task.obj_this[task.func].bind(task.obj_this);
                }else if(valid_obj_prop && (utils.obj_valid_key(task,'func') && typeof(task.func)==='function')){
                    new_func=task.func.bind(task.obj_this);
                }else if(typeof(task.func)==='function'){
                    new_func=task.func.bind(null);
                }
                if(new_func!==false){
                    new_func.apply(null,args);
                }
            }
        }
        if(!root_params.silent){
            if(reportTrace){console.trace();}
            console.log("\n\n\n================= do_terminate =================","\n");
        }
		mysql_conn.end(function(err){/*The connection is terminated now*/
//console.log('===mysql_conn.end===',arguments);
            process.on('exit', function(code){
                if(!root_params.silent){
                    console.log('===PROCESS process.on(\'exit\') EVENT===');
                    console.log("\n================= \\\\do_terminate =================","\n\n");
                }
            });
            phrowser_obj.terminate(function(){
if(!root_params.silent){console.log("\t===PROCESS phrowser_obj.terminate - ON TERMINATE EVENT =================");}
                process.exit();//nothing happens after this - except the event hadler
if(!root_params.silent){console.log('===PROCESS TERMINATED===');}//never happens thanks to 1 line above
            });
		});
    };
//varaibles
var test_fail_logs=[];
terminate_manifest.push({'func': function(){
    if(test_fail_logs.length>0){
        for(var t=0;t<test_fail_logs.length;t++){
            console.error("TEST FAILED ("+test_fail_logs[t].item+"): ",test_fail_logs[t].message);
        }
    }else{
        //assert success somehow?
        //output ip.settings?
        console.log("TESTS ARE SUCCESSFUL");
    }
}});
var doc_root='',
    root_params={'config':'./config', 'silent':false, 'found_params':[]},
    version_obj = new versionID();

var config=require('./jspkg/configurator')(process, fs, _, utils, root_params, version_obj);
doc_root=root_params.doc_root;

var mysql_conn = mysql.createConnection({
        //'debug':true,
        'database':config.db.db,
        'host': config.db.host,
        'user': config.db.user,
        'password': config.db.pass
    });
mysql_conn.version=config.db.version;

mysql_conn.on('error',function(){
    console.error('================= mysql error',arguments,"\n\n",'mysql_conn',mysql_conn);
    process.exit();
});
	
var cron_data_obj = new CronStep({'ident':'tested', 'doc_root':doc_root}),
    cacher_obj = new Cacher({'doc_root':doc_root}),
    rootCon=console,
	phrowser_obj = new Phrowser({'cacher':cacher_obj}),//,'plugin':{'on_console':function(){console.log('on_console////////////',"\n\n",arguments,"\n\n",'\\\\ on_console////////////');}}
	//base_demo_obj = new baseDemo({'phrowser':phrowser_obj,'cacher_obj':cacher_obj}),
	indexer_DB_obj = new indexerDB({'doc_root':doc_root,'mysql':mysql_conn});

terminate_manifest.push({'obj_this': cron_data_obj, 'func': 'reset' });
terminate_manifest.push({'obj_this': cron_data_obj, 'func': 'terminate' });

//object optional settings
if(root_params.silent){
    phrowser_obj.debug_level=phrowser_obj.debug_levels.off;}

var test_yellow_labs=function(urlStr,callbacks){
    if(!root_params.silent){
        console.log("\n\n================= YELLOWLABS =================","\n\n");}
    var yellowlabs = require('yellowlabtools');
    var opts = {
            'device': "desktop",//mobile? "phone" or "tablet"  "desktop"
            //'cookie': cookie_str,
            //'screenshot': file_base_str+'.png'
            'jsDeepAnalysis':true //true/false
        };
    if(typeof(instance_auth_creds)==='object' && utils.obj_valid_key(instance_auth_creds, 'user') && utils.obj_valid_key(instance_auth_creds, 'pass')){
        opts=merge(true,{},opts,{'authUser': instance_auth_creds.user, 'authPass': instance_auth_creds.pass});}
    yellowlabs(urlStr, opts)
        .then(function(data){
            if(!root_params.silent){
                console.log('Success ',data.scoreProfiles.generic.globalScore+' / 100');}
            callbacks.resolve();
        })
        .fail(function(err){
            if(!root_params.silent){
                console.log('Test failed: ',merge(true,{},opts,{'url': urlStr}));}
            callbacks.reject(err);
        })
        .finally(function(){
            if(!root_params.silent){
                console.log("\n\n================= \\\\ YELLOWLABS =================","\n\n");}   
        }
    );
};
var do_init=function(){//initalize
        /*
            - start mysql
            - verify version_obj.id (version_id)
            - reset command line check REF: ARGUMENTS/PARAMETERS above
            - start phrowser
        */
		mysql_conn.connect(function(err) {

			if(err){
                //console.error('MYSQL error connecting:  ' + err.stack);

                test_fail_logs.push({'item': 'mysql', 'message': err.stack.toString() });//err.toString()
                var err=new Error("MYSQL error connecting"+ err.stack);
                throw err;
                return false;
            }

            version_obj.setMySQLConn(mysql_conn);
            version_obj.verify(function(){//throw success
                try{
                    phrowser_obj.is_ready(function(){//fire up phrowser! - throws error on fail
                        var init_url='https://www.google.com';
                        phrowser_obj.plugin.on_page_init=false;//using is_ready just hacks this var
                        phrowser_obj.plugin.on_open=function(pkg){
console.log("==================== PHROWSER OPEN ("+init_url+") ======================");
                            pkg.allow_terminate=false;
                            var done_cb=function(){
                                    if(!cron_data_obj.init_step()){//this starts the crop stepping.  false means failure. shut it down
                                        console.error('CRON STEP error');return do_terminate();}

                                    phrowser_obj.terminate(function(){
console.log("\n\n\n================= phrowser_obj.terminate =================","\n\n\n");

                                        test_yellow_labs(init_url,{
                                            'resolve':function(){
                                                do_terminate();
                                            },
                                            'reject':function(err){
                                                test_fail_logs.push({'item': 'yellowlabs', 'message': "ERROR CODE: "+err });//yellow labs gives back #s
                                                do_terminate();
                                            },
                                        });
                                    });
                                };

                                //baeic eval test
                                phrowser_obj.PH_webpage_obj.evaluate(//grab the first load instance
                                    function(){return  (new XMLSerializer().serializeToString(document.doctype))+"\n"+document.documentElement.innerHTML+"\n"+"</html>";},
                                    function(htmlSource){
                                        var $cio=cheerio.load(htmlSource),
                                            filters={
                                                'section': $cio('*').filter('section'),
                                                'div': $cio('*').filter('div'),
                                                'h_': $cio('*').filter('h1,h2,h3,h4,h5,h6'),
                                                'p': $cio('*').filter('p')
                                            },
                                            debug_str="SECTIONs: "+filters['section'].length+" DIVs: "+filters['div'].length+" H#s: "+filters['h_'].length+" Ps: "+filters['p'].length;

if(!root_params.silent){
    console.log("FOUND HTML("+init_url+").length: ",htmlSource.length,"\n",debug_str);}
                                            if(filters['section'].length===0 && filters['div'].length===0 && filters['h_'].length===0 && filters['p'].length===0){
                                                test_fail_logs.push({'item': 'phrowser', 'message': debug_str });}
                                                
                                        try{
                                            open_html_file=cacher_obj.cache_raw(htmlSource,init_url);
                                        }catch(e){
                                            test_fail_logs.push({'item': 'cacher', 'message': e.toString() });
                                        }
                                        //phrowser_obj.stop();//don't work too hard!
                                        phrowser_obj.stop(function(){//don't work too hard!
                                            if(!root_params.silent){
                                                console.log('============= \\\\ phrowser_obj.stopped');}
                                            done_cb();
                                        });
                                });
                        };
                        phrowser_obj.open(init_url);
                    });
                }catch(e){
                    console.error('PHANTOMSJS error'+"\n",e);
                    test_fail_logs.push({'item': 'phantomsjs', 'message': e.toString() });
                }
            },
            function(reasonstr){//throw fail
                test_fail_logs.push({'item': 'version', 'message': reasonstr.toString() });
                console.error("\n" +' ======= error detection ====== '+"\n" , reasonstr.toString(), "\n" +' ======= error detection ====== '+"\n" );
                do_terminate();
            });
		});
	};

do_init();//program start here