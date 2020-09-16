tabs = {};
tabIds = [];
bookmarkMap = {};

function loadWindowList() {
    chrome.windows.getAll({populate: true}, function (windowList) {
        tabs = {};
        tabIds = [];
        for (var i = 0; i < windowList.length; i++) {
            for (var j = 0; j < windowList[i].tabs.length; j++) {
                tabIds[tabIds.length] = windowList[i].tabs[j].id;
                tabs[windowList[i].tabs[j].id] = windowList[i].tabs[j];
            }
        }

        console.info("reload");
        for (var i = 0; i < tabIds.length; i++) {
            (function (i) {
                chrome.tabs.get(tabIds[i], function (tab) {
                    if (bookmarkMap[normalizeUrl(tab.url)]) {
                        chrome.pageAction.show(tabIds[i]);
                    } else {
                        chrome.pageAction.hide(tabIds[i]);
                    }
                });
            })(i);
        }
    });
}

function appendToLog(logLine) {
    console.log(logLine);
}

chrome.tabs.onUpdated.addListener(function (tabId, props) {
    appendToLog(
        'tabs.onUpdated -- tab: ' + tabId + ' status ' + props.status +
        ' url ' + props.url);
    loadWindowList();
});

function normalizeUrl(url) {
    if (url) {
        var queryIdx = url.indexOf('?');
        if (queryIdx > 0) {
            url = url.substr(0, queryIdx);
        }
        if (url[url.length - 1] === '/') {
            url = url.substr(0, url.length - 1);
        }
    }
    return url;
}

function loadBookmarksTree(nodes) {
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.url) {
            bookmarkMap[normalizeUrl(node.url)] = 1;
        } else if (node.children) {
            loadBookmarksTree(node.children);
        }
    }
}

function reloadBookmarks() {
    console.info('reloadBookmarks', arguments);
    setTimeout(function () {
        bookmarkMap = {};
        chrome.bookmarks.getTree(function (tree) {
            loadBookmarksTree(tree);
            loadWindowList();
        });
    }, 0);
}

chrome.bookmarks.onChanged.addListener(reloadBookmarks);
chrome.bookmarks.onRemoved.addListener(reloadBookmarks);
chrome.bookmarks.onCreated.addListener(reloadBookmarks);
chrome.bookmarks.onImportEnded.addListener(reloadBookmarks);

document.addEventListener('DOMContentLoaded', function () {
    reloadBookmarks();
});