# ############################################################################################################
# ############################################################################################################
# ############################################################################################################
# #####                                     What does this script do                                     #####
# #####                                    ##########################                                    #####
# ##### 
#
# ##### IMPORTANT:
# ##### Script Focus: 'time-window' of provided --time arg (or default logStampWindow)
# #####
# ##### Reboot Script
# #####  - If API URL provides time diff within 'time-window'
# #####  - If API URL provides logged no change in completed (API-data -> progress_inc)
# #####  - If API URL provides logged no change in queue (API-data -> progress_max)
# #####  - If API URL provides 3 error results:
# #####     result.type=='error' 
# #####     non '200 http status'
# #####  - If log file(s) hasn't file-modified time diff within 'time-window'
# ##### 
# ##### Log Rotation Script
# #####  - Logs rotate based off filesize (--size arg or defaults 50MB)
# #####  - If provided rotation includes --nodelog
# ##### 
# ############################################################################################################
# ############################################################################################################

import json, urllib2 # JSON DATA PARSING & REMOTE CALL (curl)
import os, sys, subprocess, shutil
import getopt, argparse
import time, datetime

def logFlag( msg, flagType='flag' ):
    doDebug=False
    flagType=flagType.upper()
    if flagType=='LOG' or flagType=='ERROR':
        doDebug=True
    doDebug=True # hardcoded for now - DEBUGGING!!
    if doDebug==True:
        print "["+flagType.upper()+"\t@ "+datetime.datetime.fromtimestamp(gNow).strftime('%Y%m%d %H:%M:%S')+"]:\t" + msg
    return

# python cron_shadow.py ~/.crontab/crontab.log ~/.crontab/shadow-crontab.log -t 3600 -p http://localhost:3000 -d ~/.crontab -node -js api_server.js -jl test.log
# python cron_shadow.py ~/.crontab/crontab.log ~/.crontab/shadow-crontab.log -t 3600 -p http://localhost:3000 -d ~/.crontab -n=/usr/local/bin/node -js api_server.js -jl test.log
#DEFAULTS
debugArgs=False # debug passed args from terminal
#debugArgs=True # debug
gDoShutdown=False
logMaxSize=1024 * 1024 * 50 # bytes - aka 50 MB
logStampWindow=60 * 60 * 1 # every 2 hours default - how often is this script being ran - this is a last resort script
gNow=time.time()
dataErrorMax=3
#dataErrorMax=3000 # debug
dataDir='.'
dataLogFile='shadow-data.json'
dataLogSchema={'error_inc': 0, 'error_max': dataErrorMax, 'error_history': [], 'progress_inc': None, 'progress_max': None } #{'error_inc': 0, 'error_max': dataErrorMax, 'error_history': [], 'progress_inc': pingResult['progress_inc'], 'progress_max': pingResult['progress_max'] }
dataLogData=dataLogSchema
nodeCMD={'file':'','path':'','args':'','log':''}


parser = argparse.ArgumentParser(prog=os.path.basename(__file__),
                                 usage="%(prog)s [log] [options]",
                                 add_help=False)

group = parser.add_argument_group("Options")
group.add_argument("-h", "--help", "-?", "--?", action="help", help="CRON SHADOW - Rotates logs and can reboot if needed"+"Usage: python "+os.path.basename(__file__)+" sample-log.log sample-log2.log errors.txt\n\tpython "+os.path.basename(__file__)+" [files] [options]")
group.add_argument("-s", "--size", default = logMaxSize,
                    help = "show last modified date/time [default: off]",
                    metavar = "")
group.add_argument("-t", "--time", default = logStampWindow,
                    help = "Time window of log watching (in seconds) - if no logging assume dead [default: 2 hours (+"+str(logStampWindow)+"]",
                    metavar = "")
group.add_argument("files", nargs='*', help=argparse.SUPPRESS)
group.add_argument("-p", "--ping", help = "Optional 'Pinger URL'. THe URL that checks the data service for JSON { 'data': [{'last_modified': ..., 'last_modified_diff': ..., 'progress_inc': ..., 'progress_max': ... }], 'result':{'type':'success' } } ",
                    metavar = "")
group.add_argument("-d", "--dir", default = dataDir, help = "Optional base directory. Where directory of data is stored.",
                    metavar = "")
#optional arg
group.add_argument("-r", "--reboot", nargs='?', default = False,
                    help = "Rebooting an option True/False - if specified without value switches to True",
                    metavar = "")
# this was needed when we're trying to setup the API server task through python. 
# Didn't work... if there was any logging of the output the subprocess would either 
# close with the python script or block the running of the script (tried 3 ways)
# learned more about cronjobs and it is better 'seperation of concerns' to run it through
# the crontab/cronjob with the '&' at the end (which means subtask) and it can be logged
# group.add_argument("-n", "--nodepath", nargs='?', default = None,
#                     help = "Whats the node path? Needed to for start API Server",
#                     metavar = "")
# group.add_argument("-js", "--nodecmd", nargs='?', default = None,
#                     help = "Whats the node script/file? Needed to for start API Server",
#                     metavar = "")
# group.add_argument("-ja", "--nodeargs", nargs='+', type=str, default = None,
#                     help = "Whats the node args? (Optional) Needed to for start API Server (List of strings)",
#                     metavar = "")
# group.add_argument("-jl", "--nodelog", nargs='?', default = None,
#                     help = "Whats the node log file? (Optional) Needed to for start API Server. Path is auto-appeneded to use -d/--dir argument",
#                     metavar = "")

prog_args = parser.parse_args() # will exit here if there 'help' requested
if prog_args.reboot==None: # if its present as an arg then we want it!
    prog_args.reboot=True

if prog_args.time is not None:
    logStampWindow=prog_args.time

#verify directory - concate '/' to the string
if os.path.isdir(prog_args.dir)==True:
    dataDir=os.path.realpath(prog_args.dir)+'/'
else:
    dataDir=os.path.realpath(dataDir)+'/'

#node stuff - node binary
try:
    if prog_args.nodepath is None:
        prog_args.nodepath=None
except AttributeError:
    prog_args.nodepath=None

if prog_args.nodepath is not None and os.path.exists(prog_args.nodepath)==True and os.path.isfile(prog_args.nodepath)==True:
    nodeCMD['path']=prog_args.nodepath
else:
    nodeCMD['file']=None
    nodeCMD['path']=None

#node stuff - node script
try:
    if prog_args.nodecmd is None:
        prog_args.nodecmd=None
except AttributeError:
    prog_args.nodecmd=None
    
if prog_args.nodecmd is not None and os.path.exists(prog_args.nodecmd)==True and os.path.isfile(prog_args.nodecmd)==True:
    nodeCMD['file']=prog_args.nodecmd
else:
    nodeCMD['file']=None
    nodeCMD['path']=None

if prog_args.nodecmd is not None and prog_args.nodepath is not None:
    nodeCMD['args']=prog_args.nodeargs
    nodeCMD['log']=dataDir+prog_args.nodelog

#create the data log
if os.path.exists(dataDir+dataLogFile)==False:
    tmpFileObj=os.open(dataDir+dataLogFile, os.O_WRONLY | os.O_CREAT) # recreate the file
    os.write(tmpFileObj, json.dumps(dataLogSchema))
    os.close(tmpFileObj)

dataLogData=json.loads(open(dataDir+dataLogFile).read())
if debugArgs==True:
    print 'prog_args:', str(prog_args)
#logStampWindow=-1

# PING API
try:#clean pinger var
    prog_args.ping
except NameError:
    prog_args.ping = None

apiFlagged=False
if prog_args.ping is not None and len(prog_args.ping.strip())>0:
    #pingResult=json.loads(urllib2.urlopen(prog_args.ping).read())
    try:#clean ping JSON
        pingResult=json.loads(urllib2.urlopen(prog_args.ping).read())
        pingMeta=pingResult['result']
    except ValueError, e:
        logFlag( "Ping to '"+prog_args.ping+"' JSON Parsing Failed", 'error' )
        pingResult=None
        pingMeta=None
    except urllib2.URLError, e:
        logFlag( "Ping to '"+prog_args.ping+"' Failed", 'error' )
        pingResult=None
        pingMeta=None
    except:
        logFlag( "Ping to '"+prog_args.ping+"' Unknown", 'error' )
        pingResult=None
        pingMeta=None
    
    pingLogError=False
    
    if pingResult is not None and pingResult['result']['type']=="success" and len(pingResult['data'])>0:
        pingResult=pingResult['data'][0]
        #print "- pingResult: ",str(pingResult)

        pingMeta['message']=None # lazy to fix properly - if its successful but a flag for error is thrown this will get an unset error.... so just set it.. but set it so the extra logging is disabled
        if dataLogData['progress_inc']==pingResult['progress_inc']: # nothings changed?!
            gDoShutdown=True # when running in 'bigger loop mode' we want to shutdown if within an hour nothing changed - probably should adjust for 100% completed
            #pingLogError=True # comment this out when above is uncommented
            logFlag( "pingResult[progress_inc] is unchanged: "+str(dataLogData['progress_inc'])+" == "+str(pingResult['progress_inc'] ))
        if dataLogData['progress_max']==pingResult['progress_max']: # nothings changed?!
            gDoShutdown=True # when running in 'bigger loop mode' we want to shutdown if within an hour nothing changed - probably should adjust for 100% completed
            #pingLogError=True # comment this out when above is uncommented
            logFlag( "pingResult[progress_max] is unchanged: "+str(dataLogData['progress_max'])+" == "+str(pingResult['progress_max'] ))

        dataLogData['progress_inc']=pingResult['progress_inc']
        dataLogData['progress_max']=pingResult['progress_max']
        # pingResult['last_modified']
        # pingResult['last_modified_diff']
        if pingResult['last_modified_diff']>logStampWindow: # if the provided difference is larger than the allowed window... something is wrong
            gDoShutdown=True
            logFlag( "pingResult[last_modified_diff]: "+str(pingResult['last_modified_diff'])+' > '+str(logStampWindow) )
    elif pingResult is not None and pingResult['result']['type']=="error":
        pingLogError=True
        logFlag( "pingResult[result][type] is ERROR!", 'warn' )
    else:
        # if nodeCMD['file'] is not None and nodeCMD['path'] is not None: # spawn the api server!
        #     useCMDs=[]
        #     useCMDs.append(nodeCMD['path'])
        #     useCMDs.append(nodeCMD['file'])
        #     if nodeCMD['args'] is not None and len(nodeCMD['args'])>0:
        #         for cmd in nodeCMD['args']:
        #             useCMDs.append(cmd)
            
        #     TMP_STR=""
        #     for cmd in useCMDs:
        #         TMP_STR=TMP_STR+cmd+" "

        #     logFlag( "os.system(TMP_STR)! "+TMP_STR, 'warn' )
        #     if nodeCMD['log'] is None:
        #         os.system(TMP_STR+"&")
        #     else:
        #         if os.path.isfile(logFilePath)==False:
        #             logFlag( "Log File" + os.path.split(nodeCMD['log'])[1] + ' (' + nodeCMD['log'] + ') is missing', 'warn' )
        #         os.system(TMP_STR+"2> "+nodeCMD['log']+" > "+nodeCMD['log']+" &")
        #         #                  2> errorOutput.log > output.log &

        pingLogError=True # error message should be in try catch(except) above

    if pingLogError==True:
        dataLogData['error_inc']+=1
        apiFlagged=True
        appendPrefix="EVENT #"+str(dataLogData['error_inc'])+': '
        if pingMeta is not None and pingMeta['message'] is not None and len(pingMeta['message'].strip())>0:
            logFlag( 'API ERROR pingMeta: '+str(pingMeta), 'log' )
            dataLogData['error_history'].append(appendPrefix+pingMeta['message']);
        elif pingMeta is None:
            dataLogData['error_history'].append(appendPrefix+"Connection Failed");



#process the log files to be moved
logCheckInc=0
logFiles=[]
# clean our log list
if len(prog_args.files)>0:
    for f in prog_args.files:
        if f is not None and len(f.strip())>0:
            logFiles.append(f)
#lets throw the node log in!
if nodeCMD['log'] is not None and len(nodeCMD['log'].strip())>0:
    logFiles.append(nodeCMD['log'])

for logFile in logFiles:
    logFilePath=os.path.realpath(logFile)
    logPath=os.path.split(logFilePath)[0]
    #logFlag( "-File" + logFile )
    if os.path.isfile(logFilePath)==False: # not a valid file
        logFlag( "Log File" + logFile + ' (' + logFilePath + ') is missing', 'warn' )
    else:
        logSize=os.path.getsize(logFilePath)
        logStamp=os.path.getmtime(logFilePath)
        #print 'logStamp: ',logStamp,' DIFF: '
        if (gNow-logStamp)>=logStampWindow:#check time diff
            logFlag( 'Time-Window Exceeded for '+logFile+'! '+str(gNow-logStamp)+' > '+str(logStampWindow) )
            ++logCheckInc
            if logCheckInc>=len(logFiles):
                gDoShutdown=True
                logFlag( 'Time-Window Exceeded! - All log files' )

        if logSize>=logMaxSize:# log rotation needed!
            f_base = os.path.splitext(logFilePath)
            f_ext=f_base[1]
            mv_path=f_base[0]+'-('+datetime.datetime.fromtimestamp(gNow).strftime('%Y-%m-%d_%H.%M.%S')+')'+f_base[1]
            # we are 'moving' the file this way to maintain permissions (we're under sudo)
            shutil.copyfile(logFilePath, mv_path)
            fo = open(logFilePath, "w+")
            fo.truncate()
            fo.close()

if dataLogData['error_inc']>=dataErrorMax:
    logFlag( 'dataLogData[error_inc] Exceeded! '+str(dataLogData['error_inc'])+' >= '+str(dataErrorMax) )
    gDoShutdown=True # flag to shutdown
elif apiFlagged==False and dataLogData['error_inc']>0: # if the error_inc wasn't changed from the API source lets turn off the error
    dataLogData['error_inc']=0


if gDoShutdown==True:
    dataLogData=dataLogSchema # reset the var!

tmpFileObj=os.open(dataDir+dataLogFile, os.O_TRUNC | os.O_WRONLY | os.O_CREAT) # empty the file on open
os.write(tmpFileObj, json.dumps(dataLogData))
os.close(tmpFileObj)

# ================== REBOOT YES OR NO!? ================================

flareStr='.,/.o0o.\\~_++==&|^`\'`^|&+=-_'
flareStr2='_-=+&|^`\'`^|&==++_~/.o0o.\\,.'
#flareStr2=flareStr[::-1] # cheating - I COPY PASTE THIS flip the slashes... no point in writing function

if gDoShutdown==True: # log that we intended to shutdown
    logFlag( 'SHUTTING DOWN!!!!' )

#override setting if execution args turned it off
if prog_args.reboot==False: # enforce the original argument
    gDoShutdown=False

if gDoShutdown==True:
    logMsg='SHUTTING DOWN!!!!'
    logFlag( logMsg+"\n"+flareStr+' '+logMsg+' '+flareStr2, 'log' )
    if not sys.platform.startswith('darwin'): # don't randomly remboot my dev machine please!
        os.system('/sbin/shutdown -r now')
    else:
        logMsg='NO SHUT DOWN!!!! OSX(darwin) Detected'
        logFlag( flareStr+' '+logMsg+' '+flareStr2, 'log' )
else:
    logMsg='Situation Normal! Errors: '+str(dataLogData['error_inc'])+' / '+str(dataErrorMax)
    logFlag( logMsg+"\n"+flareStr+' '+logMsg+' '+flareStr2, 'log' )

