CASCADE_PATH=../Cascade
TOMCAT_PATH=../tomcat
DATABASE_DUMP_PATH=../dumps
DBNAME=cascade
USERNAME=root
PASS=hannon

cd $TOMCAT_PATH
bin/shutdown.sh

if [ -n "$2" ]; then
    cd $DATABASE_DUMP_PATH
	if [ -n "$PASS" ]; then
		PASSCMD="-p$PASS"
	fi
    mysqladmin -f -u $USERNAME $PASSCMD drop $DBNAME
	mysqladmin -u $USERNAME $PASSCMD create $DBNAME
	mysql -u $USERNAME $PASSCMD $DBNAME -e "alter database \`$DBNAME\` default character set utf8 collate utf8_unicode_ci;"
	mysql -u $USERNAME $PASSCMD --default-character-set=utf8 $DBNAME < $2
fi

cd $CASCADE_PATH
git checkout $1
git pull
ant clean
ant deploy-war
cd $TOMCAT_PATH
bin/startup.sh