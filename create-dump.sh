DATABASE_DUMP_PATH=../dumps
DBNAME=cascade
USERNAME=root
PASS=hannon

cd $DATABASE_DUMP_PATH
if [ -n "$PASS" ]; then
    PASSCMD="-p$PASS"
fi
mysqldump -u $USERNAME $PASSCMD -e --default-character-set=utf8 --add-drop-table $DBNAME > $1 2> /dev/null
echo 'Backup complete'