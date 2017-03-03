var casper = require("casper").create({
    verbose: false,
    pageSettings: {
        loadImages: true,
        loadPlugins: false
    },
    colorizerType: 'Dummy'
});
var checked = [];
var currentLink = 0;
var checkedLinks = 0;
var fs = require('fs');
var upTo = ~~casper.cli.get('max-depth') || 100;
var baseUrl = casper.cli.get(0);
var links = [];
var require = patchRequire(require)
var utils = require('utils');
var f = utils.format;
var keepDir = "./";
var jsuri = require('js-uri.js');
var lastUrl = '';

function repeatString(str, n) {
    return new Array(n + 1).join(str);
}

function padZ(num, n) {
    n = n || 2;
    var numString = num.toString();
    if (numString.length < n) {
        var numString = repeatString('0', n - numString.length) + numString;
    }
    return numString;
}

function formattedDate(d) {
    var day = d.getDate();
    var month = d.getMonth() + 1; // Note the `+ 1` -- months start at zero.
    var year = d.getFullYear();
    var hour = d.getHours();
    var min = d.getMinutes();
    var sec = d.getSeconds();
    var milli = d.getMilliseconds();
    return "["+year+"-"+padZ(month)+"-"+padZ(day)+" "+padZ(hour)+":"+padZ(min)+":"+padZ(sec)+"."+padZ(milli,3)+"] ";
}

function timeEcho(message) {
    casper.echo(formattedDate(new Date()) + message);
}

function absPath(url, base) {
    var newURI = new jsuri.URI(url)
    var baseURI = new jsuri.URI(base);
    var resolveURI = newURI.resolve(baseURI);
    return resolveURI.toString();
}

// Clean links
function cleanLinks(urls, base) {
    var uniqueURLS = utils.unique(urls);
    var filterURLS = uniqueURLS.filter(function(url) {
                                     return new RegExp('^(#|javascript|http)').test(url);
                                 });
    var filterURLS2 = filterURLS.filter(function(url) {
                                     return url.indexOf(baseUrl) === 0;
                                 });
    var filterURLS3 = filterURLS2.filter(function(url) {
                                     return url.indexOf('logout') === -1;
                                 });
    var mapURLs = filterURLS3.map(function(url) {
        return absPath.call(this, url, base);
    });
    return mapURLs.filter(function(url) {
        return links.indexOf(url) == -1;
    });
}

function addNewLinks() {
    var newLinks = searchLinks.call(this);
    links = links.concat(newLinks);
    if (keepDir) {
        try {
            var file = fs.open(keepDir + "links.lst", "a");
            for (var i = 0, len = newLinks.length; i < len; i++) {
                file.writeLine(newLinks[i]);
            }
            file.close();
        } catch (e) {
            console.log(e);
        }
    }
    timeEcho(newLinks.length + " new links found total links now " + links.length);
};

// Opens the page, perform tests and fetch next links
function crawl(link) {
    this.then(function openLink() {
        this.open(link);
        checked.push(link);
    });
    this.wait(500, function checkHTTPStatus() {
                        if (this.currentHTTPStatus === 404) {
                          this.warn(link + ' is missing (HTTP 404)');
                        } else if (this.currentHTTPStatus === 500) {
                          this.warn(link + ' is broken (HTTP 500)');
                        } else {
                            timeEcho(link + f(' is okay (HTTP %s)', this.currentHTTPStatus));
                        }
                    }
                );
    this.then(addNewLinks);
    if (this.getCurrentUrl() == baseUrl + 'login') {
        timeEcho('Adding log in');
        this.then(login);
    }
    this.then(function clickSort() {
        var headers = this.evaluate(function _fetchHeaders() {
            var elements = [].map.call(__utils__.findAll('th.tablesorter_header'), function(node) {
                                                                        return node.getAttribute('data-column');
                                                                     });
            return elements;
        });
        casper.each(headers, function clickHeader(self, header) {
            self.waitFor(function clickOnSort() {
                timeEcho('Sort click: ' + header);
                self.click('th[data-column='+header+']');
                self.wait(500, addNewLinks);
                return true;
            });
            self.waitFor(function clickOnSort() {
                timeEcho('Sort click again: ' + header);
                self.click('th[data-column='+header+']');
                self.wait(500, addNewLinks);
                return true;
            });
        } );
    });
    this.then(function clickPagination() {
        var pages = this.evaluate(function _fetchHeaders() {
            var elements = [].map.call(__utils__.findAll('div.pagination a.page'), function(node) {
                                                                        return node.getAttribute('data-page');
                                                                     });
            return elements;
        });
        pages = utils.unique(pages);
        if (pages.length > 0) {
            timeEcho('Pages: ' + pages);
            casper.each(pages, function clickPage(self, pagenumber) {
                self.waitFor(function clickOnPage() {
                    timeEcho('Page click: ' + pagenumber);
                    self.click('a.page[data-page="'+pagenumber+'"]');
                    self.wait(500, addNewLinks);
                    return true;
                });
            } );
        }
    });
    lastUrl = '';
    this.then(clickNext);
}

function clickNext() {
    if (this.exists('input[value=Next]')) {
	if (lastUrl == '' || lastUrl != this.getCurrentUrl()) {
            this.waitFor(function clickOnPage() {
                timeEcho('Next click');
                lastUrl = this.getCurrentUrl();
                this.click('input[value=Next]');
                this.wait(500, clickNext);
                return true;
            });
        } else {
            timeEcho('Stuck ' + lastUrl);
        }
    }
}

// Fetch all <a> elements from the page and return
// the ones which contains a href starting with 'http://'
function searchLinks() {
    var evaluatedLinks = this.evaluate(
                                  function _fetchInternalLinks() {
                                      return [].map.call(__utils__.findAll('a[href]'), function(node) {
                                                                                           return node.getAttribute('href');
                                                                                       });
                                  }
                                 );
    // timeEcho("evaluatedLinks " + evaluatedLinks);
    var currentURL = this.getCurrentUrl();
    var cleanedLinks = cleanLinks.call(this, evaluatedLinks, currentURL);
    return cleanedLinks;
}

// As long as it has a next link, and is under the maximum limit, will keep running
function check() {
    if (links[currentLink] && checkedLinks < upTo) {
        crawl.call(this, links[currentLink]);
        if (keepDir) {
            try {
                var file = fs.open(keepDir + "checked.lst", "a");
                file.writeLine(formattedDate(new Date()) + links[currentLink]);
                file.close();
            } catch (e) {
                console.log(e);
            }
        }
        currentLink++;
        checkedLinks++;
        this.run(check);
    } else {
        timeEcho("All done, " + checked.length + " of " + links.length + " links checked.");
        this.exit();
    }
}

function login() {
    // timeEcho('Going to log in');
    this.fill('form#loginform', {'identity': 'r_weide@yahoo.com', 'password': 'Casper@2017'}, true);
}

// casper.on('step.added', function(step) {
//     timeEcho('Step added: ' + step);
// });

function readFiles() {
    if (keepDir) {
        try {
            var file = fs.open(keepDir + "links.lst", "r");
            var fileLinks = file.read();
        } catch (e) {
            timeEcho(e);
        }
        if (file) {
            file.close();
        }
        if (fileLinks) {
            var lines = fileLinks.split('\n');
            for (var i = 0, len = lines.length; i < len; i++) {
                lines[i].trim();
                if (lines[i]) {
                    links.push(lines[i]);
                }
            }
            currentLink = links.length;
        }

        try {
            file = fs.open(keepDir + "checked.lst", "r");
            var fileChecked = file.read();
        } catch (e) {
            timeEcho(e);
        }
        if (file) {
            file.close();
        }
        if (fileChecked) {
            var lines = fileChecked.split('\n');
            for (var i = 0, len = lines.length; i < len; i++) {
                if (lines[i]) {
                    checkedSplit = lines[i].split('-');
                    checkedUrl = checkedSplit[1].trim();
                    checked.push(checkedUrl);
                }
            }
            currentLink = checked.length;
        }
    }
}

if (!baseUrl) {
    casper.warn('No url passed, aborting.').exit();
} else {
    timeEcho('Starting URL is ' + baseUrl);
}
// phantom.clearCookies();
readFiles.call();
if (links.indexOf(baseUrl) == -1) {
    links.push(baseUrl);
    if (keepDir) {
        try {
            var file = fs.open(keepDir + "links.lst", "a");
            file.writeLine(baseUrl);
            file.close();
        } catch (e) {
            console.log(e);
        }
    }
}
casper.start(baseUrl);

casper.run(check);
