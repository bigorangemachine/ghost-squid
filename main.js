//modules
var cheerio = require('cheerio'),//https://github.com/cheeriojs/cheerio
    _ = require('underscore'),//http://underscorejs.org/
    merge = require('merge'),//allows deep merge of objects
    mysql = require('mysql'),//https://github.com/felixge/node-mysql/
    phantom = require('phantom'),//https://github.com/sgentle/phantomjs-node
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
	Phrowser = require('./jspkg/phrowser'),
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
                }
            }
        }
        if(!root_params.silent){
            if(reportTrace){console.trace();}
            console.log("\n\n\n================= do_terminate PID: "+process.pid+" =================","\n");
        }
		mysql_conn.end(function(err){/*The connection is terminated now*/
//console.log('===mysql_conn.end===',arguments);
            process.on('exit', function(code){
                if(!root_params.silent){
                    console.log('===PROCESS process.on(\'exit\') EVENT===');
                    console.log("\n================= \\\\do_terminate PID: "+process.pid+" =================","\n\n");
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
var doc_root='',
    root_params={
        'silent':false,//actual settings
        'config':'./config',
        'cron_window': 1, //in minutes
        'do_postinstall':false,//functions or modes
        'do_reset':false, 
        'found_params':[]
    },
    version_obj = new versionID(),
    cron_ident='bd-test-scan',
	content_types=vars.content_types,
	capture_types=vars.capture_types;
//console.log('=============== WORKING ON GETTING VISIBILITY DETECTION. REFACTOR CODE!');process.exit();
//console.log('=============== WORKING ON GETTING READ-WRITE FOUND URLS LINE 271');process.exit();
// ARGUMENTS/PARAMETERS & SAFE USAGE
/*
    NPM START ARGUMENTS
        - 'config' variable: change 'root_params.config' which specifies application configuration file - aka what file contains database username/password
        - 'version-id' variable: change 'version_obj.id' which is specific to the database scanner sub-version - aka we're trying to keep instances of a website
        - '-ident' variable: change 'cron_ident' which is like a project or program identifyier
        - '--reset' action: reset the current thread/step. Cleans up the cache & cron stepper
                     
 //*/
// \\ ARGUMENTS/PARAMETERS & SAFE USAGE

var config=require('./jspkg/configurator')(process, fs, _, utils, root_params, version_obj),
    passive_settings=require('./jspkg/step-passive/settings__passive')(config, utils);
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
var rootCon=console,
	cacher_obj = new Cacher({'doc_root':doc_root,'auth':instance_auth_creds}),
	phrowser_obj = new Phrowser({'cacher':cacher_obj,'auth':instance_auth_creds}),//,'plugin':{'on_console':function(){console.log('on_console////////////',"\n\n",arguments,"\n\n",'\\\\ on_console////////////');}}
	indexer_DB_obj = new indexerDB({'doc_root':doc_root,'auth':instance_auth_creds,'mysql':mysql_conn}),
    scraper_obj = new scrapeURLer({'uri_parser':{
        'no-pdfs':function(uri){
            if(uri===false || typeof(uri)!=='string'){return uri;}
            var ext=utils.get_ext(uri);
            if(ext.toLowerCase()==='pdf'){return false;}
            return uri;
        },
        '*':function(uri){
            if(uri===false){return uri;}
            var qry_excl=['INTCMP','count'],//remove these query strings for comparision or storage purpose
                uri_out=uri,
                qry_ex=uri.split('?'),
                uri_base=(qry_ex.length>0 && utils.basic_str(qry_ex[0])?qry_ex[0]:uri),
                qry_str=(qry_ex.length>0 && utils.basic_str(qry_ex[1])?qry_ex.slice(1).join(''):''),
                hash_ex=uri.split('#'),
                hash_str=hash_ex.slice(0,hash_ex.length-1).join('#'),
                qry_obj=querystring.parse(qry_str),
                url_obj=url.parse(uri);
    //console.log('==============scrapeURLer * PARSER =====================',"\n\t",uri,' - url_obj',url_obj,"\n\t",'hash_str ',hash_str);
            url_obj.proto=utils.check_strip_last(url_obj.protocol, ':');
            if(url_obj.hash===null || !url_obj.hash){url_obj.hash='';}
            var clean_url=url_obj.proto + '://' + url_obj.host + url_obj.pathname;
            var allow_url=false,
                curr_step_key=cron_data_obj.current_step_key();
            //url_obj.hash.toString().length===0 &&     
            if(passive_settings.domain_list.length>0 && (curr_step_key===false || curr_step_key==='passive')){//capture no hashes - on the passive step
                for(var d=0;d<passive_settings.domain_list.length;d++){
                    var match_str=passive_settings.domain_list[d];
                    if(match_str.indexOf('://')===0){match_str=url_obj.proto+ '://' + utils.url_chomp(match_str);}//if no proto assume this proto
                    match_str=utils.check_strip_last(match_str,'/')+'/';

//console.log('clean_url: ',clean_url,"\n",'rez ',clean_url.indexOf(match_str));
                    if(clean_url.indexOf(match_str)===0){
                        allow_url=true;
                        uri_out=clean_url;
                        break;
                    }else{
                        continue;}
                }
            }
//console.log('qry_obj',qry_obj);
            var del_keys=[];
            for(var k in qry_obj){
                if(utils.obj_valid_key(qry_obj,k) && _.indexOf(qry_excl,k)!==-1){
                    del_keys.push(k);}}
            for(var d=0;d<del_keys.length;d++){
                delete qry_obj[ (del_keys[d]) ];}
            var cleaned_qs=querystring.stringify(qry_obj);
//console.log("(allow_url?uri_out:'') ",(allow_url?uri_out:''),"\n",'cleaned_qs ',cleaned_qs);
            uri_out=(utils.basic_str(cleaned_qs)?uri_out+'?'+cleaned_qs:uri_out);
if(uri_out.indexOf('/ipad')!==-1 || uri_out.indexOf('/tablets')!==-1){console.log('====== 1 off debug (iPad/tablets)! ',"\nuri:",uri,"\nuri_out:",uri_out);}//there is a weird issue with how mboility-tablets do their links (relative parent directory) Creates issues :/
            return (allow_url?uri_out:false);
        }
    }}),
    step_configs={
        'passive': require('./jspkg/step-passive/cronStep__passive')({//required shared objects
                'process': process,
                '_': _,
                'JSON': JSON,
                'url':url,
                'md5':md5,
                'merge':merge,
                'cheerio':cheerio,
                'utils': utils,
                'phrowser_obj': phrowser_obj,
                'indexer_DB_obj': indexer_DB_obj,
                'cacher_obj': cacher_obj,
                'passive_settings': passive_settings,
                'scraper_obj': scraper_obj,
                'version_obj': version_obj,
                'do_terminate': do_terminate,
                'terminate_manifest': terminate_manifest
            },
            {
                'capture_types': capture_types
            }
        ),
        'passive_data_integrity_check':{
        
        },
        'passive_data_integrity_fix':{
        
        },
        'interval':{
        
        }
    };

var cron_manifest={
        'step':{
            'steps':utils.array_keys(step_configs),
            'current':false,//which step number is it - array index num
            'inc':false,//count or increment
            'callback':{//match 'steps'
                'passive': merge(true,{}, step_configs.passive.manifest, {'end':function(pkg){//on end cronstep
                        do_terminate();
                    }})
            }
        },
        'plugin':{
            'step':function(pkg){//we're stepping!
                var curr_step_key=cron_data_obj.current_step_key();
console.log("===================\n","-step("+cron_data_obj.cache_data.step.inc+': '+cron_data_obj.cache_data.offset.inc+'/'+cron_data_obj.cache_data.offset.size+") \n\t",'curr_step_key: ',curr_step_key,"\n","===================\n");
                if(curr_step_key==='passive'){
                    step_configs.passive.step_action(pkg);
                }
            },
            'pre_init':function(pkg){
//console.log("-pre_init version_obj.id ",version_obj,' this.ident ',this.ident );
                if(version_obj.id!==false){
                    this.ident=version_obj.thread_str(this.ident.toString());
                }
            },
            'init':function(pkg){
            }
        },
        'offset':{'size':(typeof(passive_settings.offset_size)==='number'?passive_settings.offset_size:150)},
        'o_lock':{'lock_timeout': (typeof(root_params.cron_window)==='number' && root_params.cron_window>0?root_params.cron_window*60:passive_settings.cron_window) * 3},//lock timeout 3 minute (for crons that run every minute) - this should be 3 times your cron job window
        'step_timeout_time':(typeof(passive_settings.step_timeout)==='number'?passive_settings.step_timeout:25),//in milliseconds - settimeout delay - VERY FAST
        'exceed_time':false,//false we never willingly give up!
        'ident':cron_ident,
        'doc_root':doc_root
    };
var cron_data_obj = new CronStep(cron_manifest);
terminate_manifest.push({'obj_this': cron_data_obj, 'func': 'terminate' });
//object optional settings
if(root_params.silent){
    phrowser_obj.debug_level=phrowser_obj.debug_levels.off;
}
version_obj.plugin.change=function(){
    cron_data_obj.terminate();//safe off
    cron_data_obj = new CronStep(cron_manifest);//reset the settings for cron_data_obj.  Just to reset the thread_id -    
};
var do_init=function(){//initalize
        /*
            - start mysql
            - verify version_obj.id (version_id)
            - reset command line check REF: ARGUMENTS/PARAMETERS above
            - start phrowser
        */
		mysql_conn.connect(function(err) {
            if(root_params.do_postinstall){do_postinstall();return;}
			if(err){
                console.error('error connecting: ' + err.toString());//was err.stack - more detailed
                do_terminate(false);
                return;
            }
            version_obj.setMySQLConn(mysql_conn);//pass the connected db object in
            version_obj.verify(function(){//throw success
console.log('-version_obj.verify ');
                    if(root_params.do_reset){do_reset();return;}
            
                    var curr_step_key=cron_data_obj.current_step_key();
                    if((curr_step_key===false || curr_step_key==='passive')){//cycle passive
                        step_configs.passive.init_action.apply(cron_data_obj, []);
                    }else if(utils.obj_valid_key(step_configs,curr_step_key) && typeof(step_configs[curr_step_key])==='function'){//anything else
                        step_configs[curr_step_key].init_action.apply(cron_data_obj, []);
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
	},
    do_postinstall=function(){
        var db_file='_dev/crawler'+(mysql_conn.version=='5.5'?'.mysql.5.5':'')+'.sql',
            bold_chr=vars.console_chrs.bold,
            unbold_chr=vars.console_chrs.unbold,
            db_fullpath=fs.realpathSync(db_file);
        
        //send a message to the terminal! - MANUAL INSTRUCTIONS
        console.log(bold_chr+"\n\n================= MANUAL INSTRUCTIONS ================="+unbold_chr);
        console.log(bold_chr+"Modify "+unbold_chr+"config.js"+bold_chr+" modify object "+unbold_chr+"config.db"+bold_chr+" to use your database setting (indicate mysql version 5.5 if you use that version)"+unbold_chr);
        console.log("\nCreate MySQL database from _dev/crawler.sql (or 5.5 version _dev/crawler.mysql.5.5.sql)\n"+
                    "Basically run Command(s):\n"+
                    bold_chr+"mysql -u <username> -p `[YOUR_DB_NAME]` < "+db_fullpath+unbold_chr+"\n"+
                    "\n-OR (Multi-step through mySQL console)-\n\n"+
                    bold_chr+"mysql -u root -p"+unbold_chr+"\n"+
                    "\n-WITHIN MySQL CONSOLE-\n\n"+
                    bold_chr+"CREATE DATABASE `[YOUR_DB_NAME]`;"+unbold_chr+"\n"+
                    bold_chr+"USE `[YOUR_DB_NAME]`;"+unbold_chr+"\n"+
                    bold_chr+"SOURCE "+db_fullpath+";"+unbold_chr+"\n"+
                    "\n"+
                "");
        console.log(bold_chr+"================= \\\\MANUAL INSTRUCTIONS =================\n\n"+unbold_chr);
        do_terminate();
    },
    do_reset=function(){//reset or aka uninstall
console.log("\n\n\n================= do_reset =================","\n\n\n");
        var end_fired=false,
            end_func=function(){
console.log('==========do_reset - end_func==============');
                if(end_fired){return;}
                end_fired=true;
                cacher_obj.reset();
                cron_data_obj.reset();

                var node_params=utils.array_object_search(root_params.found_params,'arg','version-id');
                if(node_params.length===0){
                    version_obj.id=false;
                    cron_data_obj.reset();
                }

                do_terminate();
            },
            modes={
                'passive':['url_sources'],
                'passive_data_integrity_check':[],
                'passive_data_integrity_fix':[],
                'interval':[]
            },
            curr_step_key=cron_data_obj.current_step_key();
        if(curr_step_key!==false){
            indexer_DB_obj.reset(modes[curr_step_key], function(){//after db calls
//console.log('==========do_reset - after db calls==============');//,arguments
                end_func();
            });
        }else{
            end_func();
        }
	};

do_init();//program start here
