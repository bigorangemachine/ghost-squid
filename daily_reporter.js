//modules
var cheerio = require('cheerio'),//https://github.com/cheeriojs/cheerio
    _ = require('underscore'),//http://underscorejs.org/
    merge = require('merge'),//allows deep merge of objects
    mysql = require('mysql'),//https://github.com/felixge/node-mysql/
    phantom = require('phantom'),//https://github.com/sgentle/phantomjs-node
    yellowlabs = require('yellowlabtools'),
    fs = require('fs'),
    url = require('url'),
    querystring = require('querystring'),
    md5 = require('MD5'),
    repeat = require('string.prototype.repeat'),//FOR EASY DEBUGGING :D
    JSON = require('JSON');
//custom modules
var Cacher = require('./jspkg/cacher'),
	scrapeURLer = require('./jspkg/scrapeURLer'),
	utils = require('./jspkg/utils'),
	indexerDB = require('./jspkg/indexerDB'),
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
if(task.obj_this===cron_data_obj){cron_data_obj.reset();}//this is temp
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
            process.exit();
		});
    };
//varaibles
var doc_root='',
    root_params={
        'silent':false,//actual settings
        'config':'./config',
        'cron_window': 1, //in minutes
        'found_params':[]
    },
    cron_ident='bd-200-reporter',
    version_obj = new versionID(),
	content_types=vars.content_types,
	capture_types=vars.capture_types;

var config=require('./jspkg/configurator')(process, fs, _, utils, root_params, version_obj),
    yellow_step_settings=require('./jspkg/step-analytics/settings__analytics')(config, utils);
doc_root=root_params.doc_root;
if(!config || config.db.type.toLowerCase()!=='mysql'){console.error('ONLY DEVELOPED FOR MYSQL');process.exit();}

var instance_auth_creds = utils.get_auth_creds(config.init_url, {'config':config,'url':url}) || {};//if false set to object;

if(!root_params.silent){console.log('DB SETTINGS: ',merge(true,{},config.db,{'user':vars.const_str.omitted,'pass':vars.const_str.omitted}));}
var mysql_conn = mysql.createConnection({
        //'debug':true,
        'database':config.db.db,
        'host': config.db.host,
        'user': config.db.user,
        'password': config.db.pass
    });
mysql_conn.version=config.db.version;
var indexer_DB_obj = new indexerDB({'doc_root':doc_root,'auth':instance_auth_creds,'mysql':mysql_conn}),
    step_configs={};
function cron_manifest_func(){//maintaining formatting for git commits
    step_configs={
        'harvest': require('./jspkg/step-analytics/cronStep__analytics-harvest')({//required shared objects
                'process': process,
                '_': _,
                'JSON': JSON,
                'querystring':querystring,
                'url':url,
                'md5':md5,
                'vars': vars,
                'merge':merge,
                'cheerio':cheerio,
                'utils': utils,
                'indexer_DB_obj': indexer_DB_obj,
                'yellowlabs': yellowlabs,
                'yellow_step_settings': yellow_step_settings,
                'version_obj': version_obj,
                'do_terminate': do_terminate,
                'terminate_manifest': terminate_manifest
            }
        ),
        'analytics':require('./jspkg/step-analytics/cronStep__analytics')({//required shared objects
                'process': process,
                '_': _,
                'JSON': JSON,
                'url':url,
                'md5':md5,
                'doc_root':doc_root,
                'config':config,
                'root_params':root_params,
                'fs':fs,
                'merge':merge,
                'cheerio':cheerio,
                'utils': utils,
                'indexer_DB_obj': indexer_DB_obj,
                'yellow_step_settings': yellow_step_settings,
                'version_obj': version_obj,
                'do_terminate': do_terminate,
                'terminate_manifest': terminate_manifest
            }
        ),
        'unset':require('./jspkg/step-analytics/cronStep__analytics-unset')({//required shared objects
                'process': process,
                '_': _,
                'JSON': JSON,
                'url':url,
                'md5':md5,
                'merge':merge,
                'cheerio':cheerio,
                'utils': utils,
                'indexer_DB_obj': indexer_DB_obj,
                'yellow_step_settings': yellow_step_settings,
                'version_obj': version_obj,
                'do_terminate': do_terminate,
                'terminate_manifest': terminate_manifest
            }
        ),
        'sleeping':require('./jspkg/step-analytics/cronStep__analytics-sleeping')({//required shared objects
                'process': process,
                '_': _,
                'JSON': JSON,
                'url':url,
                'md5':md5,
                'merge':merge,
                'cheerio':cheerio,
                'utils': utils,
                'indexer_DB_obj': indexer_DB_obj,
                'yellow_step_settings': yellow_step_settings,
                'version_obj': version_obj,
                'do_terminate': do_terminate,
                'terminate_manifest': terminate_manifest
            }
        )
    };
return {
        'step':{
            'steps':utils.array_keys(step_configs),
            'current':false,//which step number is it - array index num
            'inc':false,//count or increment
            'callback':{//match 'steps'
                'harvest': merge(true,{}, step_configs.harvest.manifest, {'end':function(pkg){//on end cronstep
                        do_terminate();
                    }}),
                'analytics':merge(true,{}, step_configs.analytics.manifest, {'end':function(pkg){//on end cronstep
                        do_terminate();
                    }}),
                'unset':merge(true,{}, step_configs.unset.manifest, {'end':function(pkg){//on end cronstep
                        do_terminate();
                    }}),
                'sleeping':merge(true,{}, step_configs.sleeping.manifest, {'end':function(pkg){//on end cronstep
                        do_terminate();
                    }})
            }
        },
        'plugin':{
            'step':function(pkg){//we're stepping!
                var curr_step_key=cron_data_obj.current_step_key();
console.log("===================\n","-step("+cron_data_obj.cache_data.step.inc+': '+cron_data_obj.cache_data.offset.inc+'/'+cron_data_obj.cache_data.offset.size+") \n\t",'curr_step_key: ',curr_step_key,"\n","===================\n");
                if(curr_step_key==='harvest' && typeof(step_configs.harvest.step_action)==='function'){
                    step_configs.harvest.step_action(pkg);
                }else if(curr_step_key==='analytics' && typeof(step_configs.analytics.step_action)==='function'){
                    step_configs.analytics.step_action(pkg);
                }else if(curr_step_key==='unset' && typeof(step_configs.unset.step_action)==='function'){
                    step_configs.unset.step_action(pkg);
                }else if(curr_step_key==='sleeping' && typeof(step_configs.sleeping.step_action)==='function'){
                    step_configs.sleeping.step_action(pkg);
                }
            },
            'pre_init':function(pkg){
console.log("pre_init version_obj.id ",version_obj,' this.ident ',this.ident );
                if(version_obj.id!==false){
                    this.ident=version_obj.thread_str(this.ident.toString());
console.log("\t"+"pre_init version_obj.id ",version_obj,' this.ident ',this.ident );
                }
            },
            'init':function(pkg){
            }
        },
        'offset':{'size':(typeof(yellow_step_settings.offset_size)==='number'?yellow_step_settings.offset_size:10)},
        'o_lock':{'lock_timeout': (typeof(root_params.cron_window)==='number' && root_params.cron_window>0?root_params.cron_window*60:yellow_step_settings.cron_window) * 3},//lock timeout 3 minute (for crons that run every minute) - this should be 3 times your cron job window
        'step_timeout_time':(typeof(yellow_step_settings.step_timeout)==='number'?yellow_step_settings.step_timeout:25),//in milliseconds - settimeout delay - VERY FAST
        'exceed_time':false,//false we never willingly give up!
        'ident':cron_ident,
        'doc_root':doc_root
    };
};
var cron_data_obj = new CronStep(cron_manifest_func());
terminate_manifest.push({'obj_this': cron_data_obj, 'func': 'terminate' });

version_obj.plugin.change=function(){
console.log('===== VERSION_OBJ CHANGE=======');
    cron_data_obj.terminate();//safe off
    cron_data_obj = new CronStep(cron_manifest_func());//reset the settings for cron_data_obj.  Just to reset the thread_id -    
};

var curr_step=cron_data_obj.current_step_key(),
    curr_step_path='jspkg/step-analytics/settings__'+curr_step.toString();
if(curr_step!==false && fs.existsSync(curr_step_path)){
    var _settings=yellow_step_settings=require('./'+curr_step_path)(config, utils);
    if(_settings!==yellow_step_settings){
        yellow_step_settings=merge(true, {}, yellow_step_settings, _settings);
console.log('yellow_step_settings',yellow_step_settings);
        cron_data_obj.terminate();//safe off
        cron_data_obj = new CronStep(cron_manifest_func());//reset the settings for cron_data_obj.
    }
}

//this is the init()!
mysql_conn.connect(function(err){
    if(err){
        console.error('[MYSQL] error connecting: ' , err.toString());do_terminate(false);return;
    }
    version_obj.setMySQLConn(mysql_conn);

    version_obj.verify(function(){//throw success
console.log('-version_obj.verify success ',version_obj.id);
            
            var curr_step_key=cron_data_obj.current_step_key();
console.log('MYSQL_CONN.CONNECT\'d: curr_step_key',curr_step_key);
            if((curr_step_key===false || curr_step_key==='harvest')){//cycle harvest
                step_configs.harvest.init_action.apply(cron_data_obj, []);
            }else if(curr_step_key==='analytics'){
                step_configs.analytics.init_action.apply(cron_data_obj, []);
            }else{
                console.log("NO STEP SPECIFIED");
                do_terminate(false);
            }
        },
        function(reasonstr){//throw fail
            console.error("\n" +' ======= error detection ====== '+"\n" , reasonstr.toString(), "\n" +' ======= error detection ====== '+"\n" );
            if(root_params.do_reset){do_reset();return;}
            do_terminate();
        }
    );
});
