#!/bin/bash
if [ -f kyos-crawler-running.txt ]; then
    exit
fi
if [ `expr $(date +%s) - $(date +%s -r checked.lst)` -ge 3600 ]; then
    foldername=`date +"%Y%m%d%H%M"`
    mkdir $foldername
    mv cookies.txt links.lst checked.lst crawler.log $foldername
fi
echo 'Running' > kyos-crawler-running.txt
casperjs --cookies-file=cookies.txt --ssl-protocol=any --ignore-ssl-errors=true kyos-crawler.js https://windev.kyos.com/ >> /kyos/kyos-crawler/crawler.log
rm kyos-crawler-running.txt
