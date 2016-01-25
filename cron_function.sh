#!/bin/bash


#@Usage:
#@ default (easy) usage
#@  ghost-squid "node main.js"
#@ with minute and hour pattern (every minute aka default note: escape the asterisk)
#@  ghost-squid */1 \* "node main.js"
#@ with minute and hour pattern (12 hours note: escape the asterisk)
#@  ghost-squid \* */12 "node main.js"
#@ with minute and hour pattern (every 3hrs 30mins)
#@  ghost-squid */30 */3 "node main.js"
#@ Tell the crontab to start
#@  ghost-squid start
#@  ghost-squid go
#@ Tell the crontab to stop
#@  ghost-squid stop
#@ Tell the crontab to list tasks
#@  ghost-squid view
#@  ghost-squid list
#@ Tell the crontab to reset - remove the crontab file
#@  ghost-squid reset
function ghost-squid {
	local DO_DEBUG=false;
	#DO_DEBUG=true;
if [ $DO_DEBUG == true ]; then
	#SET DEBUG
	set -x
fi
	local NL="#\r";
	# I think 2>&1 means log errors to the same place you are 'redirecting' (piping) terminal outputs to
	local CRON_TAIL=" 2>&1 &#"; # ending with '&' means subprocess (non-blocking) 
	local CRON_TAIL_B=" 2>&1#"; # blocking rather than subprocesses
	local DAEMON_MODE=false;
	local DISABLE_EMAIL=true;

	if [ "$PIENV" == "true" ]; then
        local TARGET_UID="pi";
		local BASE_DIR="$HOME/.crontab";
		DAEMON_MODE=true;
	else
        local TARGET_UID="McOrange"; # McOrange Works :/
		local BASE_DIR="$HOME/localhost/_crontab";
	fi
	local FILE_CRON="$BASE_DIR/ghost-squid.job";
	local LINES_FILE_CRON=();
	local FILE_CRON_SUDO="$BASE_DIR/ghost-squid-sudo.job";
	local LINES_FILE_CRON_SUDO=();
	local CWD=$(pwd);
	local T_SPACE=" ";
	local ALLEXC=$@; # all argument
	local EXC=${@: -1}; # last argument - should be "cmd some/path/to/file.ext"
	local CMD_LEN=${#EXC}; #length of this string $EXC
	local SPACE_POS=`expr index "$EXC" "$T_SPACE"`;
	#SPACE_POS=${SPACE_POS#0};
	SPACE_POS=`expr $SPACE_POS + 1`;
	local CRON_CMD=`expr substr "$EXC" $SPACE_POS $CMD_LEN`;
	local CRON_CMD_FILE="$CRON_CMD";
	SPACE_POS=`expr $SPACE_POS - 2`;
	local FILE_EXC=`expr substr "$EXC" 1 $SPACE_POS`;
	SPACE_POS=`expr index "$CRON_CMD" "$T_SPACE"`;
	if [ $SPACE_POS -gt 0 ]; then # adujust for any cron command arguments
		SPACE_POS=`expr $SPACE_POS - 1`; # adjust for next use
		CRON_CMD_FILE=`expr substr "$CRON_CMD" 1 $SPACE_POS`;
	fi
#printf -e "$FILE_EXC: $FILE_EXC\n\tEXC: $EXC\n\tCRON_CMD: $CRON_CMD\n\tCRON_CMD_FILE: $CRON_CMD_FILE";

	unset T_SPACE;
	unset SPACE_POS;
	unset CMD_LEN;

	#first argument
	if [ "$EXC" == "START" ] || [ "$EXC" == "start" ] || [ "$EXC" == "GO" ] || [ "$EXC" == "go" ]; then
		local TMP_STR="sudo -u $TARGET_UID crontab $FILE_CRON"; #FOR SPECIFIED USER!
		echo "*********** INITIATING CRON FILE $FILE_CRON ****************";
		echo "$TMP_STR";
		eval "$TMP_STR";
		local TMP_STR="sudo crontab $FILE_CRON_SUDO"; #FOR SUDO
		echo "*********** INITIATING CRON FILE $FILE_CRON_SUDO ****************";
		echo "$TMP_STR";
		eval "$TMP_STR";
		#return;
	elif [ "$EXC" == "STOP" ] || [ "$EXC" == "stop" ]; then
		echo "*********** CRONTABS FOR USER $TARGET_UID ****************";
		eval "sudo -u $TARGET_UID crontab -r";
		echo "*********** CRONTABS FOR SUDO ****************";
		eval "sudo crontab -r";
		#return;
	elif [ "$EXC" == "VIEW" ] || [ "$EXC" == "view" ] || [ "$EXC" == "LIST" ] || [ "$EXC" == "list" ]; then
		echo "*********** VIEWING CRONTABS FOR USER $TARGET_UID ****************";
		eval "sudo -u $TARGET_UID crontab -l";
		echo "*********** \\\\ VIEWING CRONTABS FOR USER $TARGET_UID ****************";
		echo "*********** VIEWING CRONTABS FOR SUDO ****************";
		eval "sudo crontab -l";
		echo "*********** \\\\ VIEWING CRONTABS FOR SUDO ****************";
		#return;
	elif [ "$EXC" == "RESET" ] || [ "$EXC" == "reset" ]; then
		local DO_STOP=false;
		echo "*********** REMOVING CRON FILE $FILE_CRON ****************";
		if [  -e "$FILE_CRON" ]; then
			DO_STOP=true;
			eval "rm $FILE_CRON";
		fi
		echo "*********** \\\\ REMOVING CRON FILE $FILE_CRON ****************";
		echo "*********** REMOVING CRON FILE $FILE_CRON_SUDO ****************";
		if [  -e "$FILE_CRON_SUDO" ]; then
			DO_STOP=true;
			eval "rm $FILE_CRON_SUDO";
		fi
		echo "*********** \\\\ REMOVING CRON FILE $FILE_CRON_SUDO ****************";
		if [ $DO_STOP == true ]; then
			eval "ghost-squid stop";
		fi
		#return;
	elif [ ! -e "$CWD/$CRON_CMD_FILE" ] || [ ! -f "$CWD/$CRON_CMD_FILE" ]; then # exists and is a proper file?!
		echo -e "Task is Invalid ('$CWD/$CRON_CMD_FILE' does not exist)";
		#return;
	else
		if [ "$FILE_EXC" == 'node' ]; then
			FILE_EXC="/usr/local/n/versions/node/4.2.2/bin/$FILE_EXC";
			#FILE_EXC="/usr/local/Cellar/node/0.10.35_1/bin/$FILE_EXC";
			#FILE_EXC="./node";
		fi
		local EXC_BASENAME="${EXC##*/}"; #not used!?
		local MIN_PAT=$1;
		if [ ${#MIN_PAT} == 0 ] || [ "$EXC" == "$MIN_PAT" ]; then # find the provided min pattern - if it matches the first arguement then there is no min patterns
			#MIN_PAT="*/5";
			MIN_PAT="*/1";
		fi
		if [ "$MIN_PAT"=="*/1" ]; then
			MIN_PAT="*";
		fi
		local HR_PAT=$2;
		if [ ${#HR_PAT} == 0 ]; then # find the provided hour pattern
			HR_PAT="*";
		fi

		#stat -c%s ~/localhost/www/CSS_indexer/main.js 
		local LOG_FILES=(
			"$FILE_CRON"
			"$FILE_CRON_SUDO"
		);
		#setting up the .job files - the cron tab rules which get loaded in
		for i in "${LOG_FILES[@]}"
		do
			if [ ! -e "$i" ]; then # does this file not exist?! this file is needed for loading/unloading of crontabs
				echo -e "CREATING FILE FOR $i";
				touch "$i";
				sleep 0.5;
				eval "sudo chmod 777 $i";
				eval "sudo chmod +x $i";
				if [ $DISABLE_EMAIL == true ]; then
					echo "MAILTO=\"\"" >> "$i";
				else
					if [ "$i" == "$FILE_CRON_SUDO" ];then
						echo "MAILTO=\"$TARGET_UID-sudo\"" >> "$i";
					else
						echo "MAILTO=\"$TARGET_UID\"" >> "$i";
					fi
				fi
				echo "# minute hour day-of-mo month day-of-w" >> "$i";
				echo "#     *    *         *     *        * " >> "$i";
				echo "" >> "$i"; # line break
			fi
		done
		unset LOG_FILES;
		#local LOG_FILE="_cron_-`date +\%Y\%m\%d`--`date +\%H-\%M-\%S`.`date +\%N`.log"; # N is nano seconds
		local LOG_FILE="crontab.log";
		local EVAL_STR="$MIN_PAT $HR_PAT * * * export PATH=\$PATH:$PATH; $FILE_EXC $CWD/$CRON_CMD >> $BASE_DIR/$LOG_FILE$CRON_TAIL";

		local HR_DBL_PAT=`expr substr "$HR_PAT" 1 2`; # POS 1 - STARTS AT 1
		local HR_SINGLE_PAT=`expr substr "$HR_PAT" 1 1`;
		local SHADOW_PATS=(); # patterns that are needed
		local PARSED_HR="";
		local DEFAULT_HRS=1;
		local SHADOW_TIMEOUT_WINDOW=`expr 60 \* 60 \* $DEFAULT_HRS`; # 1 hour in seconds
		local SHADOW_PAT="0 $HR_PAT * * *";
		local SHADOW_API_JS="api_server.js";
		local SHADOW_CMD="cron_shadow.py";
		local SHADOW_LOG="express.log";
		local SHADOW_URI="http://localhost:3000";

		if [ "$HR_DBL_PAT" == '*/' ]; then # wild card needs to be parsed
			local HR_PAT_LEN=${#HR_PAT}; #length of this string $HR_PAT
			PARSED_HR=`expr substr "$HR_PAT" 3 $HR_PAT_LEN`;
#echo "PARSED_HR $PARSED_HR ----- ${#PARSED_HR}$NLHR_PAT_LEN $HR_PAT_LEN";
			PARSED_HR=`expr $PARSED_HR \* 3`; # CALCULATE 3 TIMES THE PROVIDED HOUR WINDOW
#echo "(AF) PARSED_HR $PARSED_HR";
			#local SHADOW_PAT="${PARSED_HR}hrs"; # no hrs specified then lets do every 3 times the specified hrs passed as '(settings_hrs * 3)hrs'
			local TMP_PAT='';
			local TMP_HR_MAX=24;
			for (( i=PARSED_HR; i <= TMP_HR_MAX; i+=PARSED_HR ))
			do
				if [ $i -ge $TMP_HR_MAX ]; then # if $i>$max
					SHADOW_PATS+=("0 0 * * *");
				else
					SHADOW_PATS+=("0 $i * * *");
				fi
			done
			
            SHADOW_TIMEOUT_WINDOW=`expr $PARSED_HR \* 60 \* 60`;#convert to seconds for shadow script
            unset TMP_PAT;
            unset TMP_HR_MAX;
            unset i;
		elif [ "$HR_SINGLE_PAT" == '*'  ]; then # not specified
            PARSED_HR="$DEFAULT_HRS";
			SHADOW_PATS+=("0 */$DEFAULT_HRS * * *"); # no hrs specified then lets do every 1hr
		else
			SHADOW_PATS+=(SHADOW_PAT); # this doesn't get a default so set one
		fi
		
		#SHADOW_PATS+=("*/10 * * * *"); #test debuging - recomment this later
		#SHADOW_PATS+=("*/3 * * * *"); #test debuging - recomment this later
		local EVAL_SHADOW="";
		local EVAL_SHADOW_SUDO="";
		local TMP_API="export PATH=\$PATH:$PATH; $FILE_EXC $CWD/$SHADOW_API_JS >> $BASE_DIR/$SHADOW_LOG$CRON_TAIL$NL";
		#                    python cron_shadow.py ~/.crontab/crontab.log ~/.crontab/shadow-crontab.log -t 3600 -p http://localhost:3000 -d ~/.crontab -n=/usr/local/bin/node -js api_server.js -jl express.log
		#                    python $CWD/cron_shadow.py $BASE_DIR/$LOG_FILE $BASE_DIR/shadow-$LOG_FILE -t $SHADOW_TIMEOUT_WINDOW -p $SHADOW_URI -d $BASE_DIR -n=$FILE_EXC -js $SHADOW_API_JS -jl $SHADOW_LOG -r >> $BASE_DIR/shadow-$LOG_FILE$CRON_TAIL
		#local TMP_SUDO="sudo python $CWD/$SHADOW_CMD $BASE_DIR/$LOG_FILE $BASE_DIR/shadow-$LOG_FILE -t $SHADOW_TIMEOUT_WINDOW -p $SHADOW_URI -d $BASE_DIR -n=$FILE_EXC -js $SHADOW_API_JS -jl $SHADOW_LOG -r >> $BASE_DIR/shadow-$LOG_FILE$CRON_TAIL";
		local TMP_SUDO="sudo python $CWD/$SHADOW_CMD $BASE_DIR/$LOG_FILE $BASE_DIR/shadow-$LOG_FILE -t $SHADOW_TIMEOUT_WINDOW -p $SHADOW_URI -d $BASE_DIR";

		if [ $DAEMON_MODE == true ]; then # set reboot only for daemon servers (not my development machine please)
			TMP_SUDO="${TMP_SUDO} -r";
		fi
		TMP_SUDO="${TMP_SUDO} >> $BASE_DIR/shadow-$LOG_FILE$CRON_TAIL";

		for i in "${SHADOW_PATS[@]}"
		do
			LINES_FILE_CRON_SUDO+=("# NODE API SCRIPT - LARGE LOOP INTERVAL");
			LINES_FILE_CRON_SUDO+=("$i $TMP_API");
			LINES_FILE_CRON_SUDO+=("");
			
			LINES_FILE_CRON_SUDO+=("# PYTHON SCRIPT - LARGE LOOP INTERVAL ");
			LINES_FILE_CRON_SUDO+=("$i $TMP_SUDO");
			LINES_FILE_CRON_SUDO+=("");
			
		done

		# little custom code to startup these two together
		local REBOOT_EXTRA="";
		local REBOOT_EXTRA_CMT="";
		if [ "$TARGET_UID" == 'McOrange' ]; then
			REBOOT_EXTRA="sudo /usr/local/mysql/support-files/mysql.server start [--time_zone=-0500] >> $BASE_DIR/mysql-reboot-$LOG_FILE && ";
			REBOOT_EXTRA_CMT="CUSTOM TO MCORANGE - MYSQL STARTUP (BLOCKING) THEN -> ";
		fi

		local EVAL_COMMENT="$NL# NODE API SCRIPT - REBOOT $NL";
		LINES_FILE_CRON_SUDO+=("# ${REBOOT_EXTRA_CMT}NODE API SCRIPT - REBOOT");
		LINES_FILE_CRON_SUDO+=("@reboot (STMP=\`date +%Y-%m-%d\`--\`date +%H.%M.%S\`.\`date +%N\`; echo \"CRONREBOOTED: \$STMP\" >> $BASE_DIR/reboot-$LOG_FILE)$CRON_TAIL");
		LINES_FILE_CRON_SUDO+=("@reboot ${REBOOT_EXTRA}export PATH=\$PATH:$PATH; $FILE_EXC $CWD/$SHADOW_API_JS >> $BASE_DIR/$SHADOW_LOG$CRON_TAIL");
		LINES_FILE_CRON_SUDO+=("@reboot $TMP_SUDO");

		unset TMP_SUDO;
		unset EVAL_COMMENT;

		echo -e "$EVAL_STR"; # echo for the terminal
		LINES_FILE_CRON+=("$EVAL_STR");
		LINES_FILE_CRON+=("");


		eval "sudo chmod u+x $SHADOW_CMD"; # python script will get 'permission denied errors'
		# write '$TARGET_UID' user cronjobs
		echo -e "STARTING SHADOW TASK! (Reboot every ${SHADOW_PATS[@]})";
		for i in "${LINES_FILE_CRON[@]}" # because 'echo' can't insert new lines properly; things must echo'd by single line
		do
			echo -e "$i"; # echo for the terminal
			echo -e "$i" >> "$FILE_CRON"; # into the file!
		done
		echo -e "" >> "$FILE_CRON"; # new line into file

		# write sudo user cronjobs
		for i in "${LINES_FILE_CRON_SUDO[@]}" # because 'echo' can't insert new lines properly; things must echo'd by single line
		do
			echo -e "$i"; # echo for the terminal
			echo -e "$i" >> "$FILE_CRON_SUDO"; # into the file!
		done
		echo -e "" >> "$FILE_CRON_SUDO";

		unset HR_DBL_PAT;
		unset HR_SINGLE_PAT;
	fi
#
if [ $DO_DEBUG == true ]; then
	#RESTORE NORMAL DEBUG
	set +x
fi
}



# if the script is ran run this... otherwise copy-paste into your .bash_profile for easy use
ghost-squid "reset";
sleep 2;
ghost-squid "*/2" "*" "node main.js time-window=2";
sleep 2;
ghost-squid "start";