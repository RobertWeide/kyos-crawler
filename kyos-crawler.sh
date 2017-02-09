#!/bin/bash
if [ -f kyos-crawler-running.txt ]; then
    exit
fi
if [ `expr $(date +%s) - $(date +%s -r checked.lst)` -ge 3600 ]; then
    foldername = `date +"%Y%m%d%H%M"`
    mkdir $foldername
    mv cookies.txt links.lst checked.lst $foldername
fi
echo 'Running' > kyos-crawler-running.txt
casperjs --cookies-file=cookies.txt kyos-crawler.js http://win.kyos.com/develop/
rm kyos-crawler-running.txt
