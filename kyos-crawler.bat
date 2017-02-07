if exist kyos-crawler-running.txt exit
echo 'Running' > kyos-crawler-running.txt
casperjs --cookies-file=cookies.txt kyos-crawler.js http://localhost/
del kyos-crawler-running.txt
