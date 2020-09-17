tabs = {};
tabIds = [];
bookmarkMap = {};

function brief(s, length) {
    length = length || 18;
    if (length < 5) {
        length = 5;
    }
    if (s.length > length) {
        return s.substr(0, length - 3) + '...';
    } else {
        return s;
    }
}

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
                    var items = bookmarkMap[normalizeUrl(tab.url)];
                    if (items) {
                        chrome.pageAction.show(tabIds[i]);
                        var markInfo = items.length > 1 ? '【已收藏多个！】' : '【已收藏】';
                        if (items.length > 2) {
                            items = items.slice(0, 2);
                        }
                        var title = '智能书签识别\n' + markInfo + '\n';
                        for (var j = 0; j < items.length; j++) {
                            var item = items[j];
                            var itemInfo = '';
                            for (var k = 0; k < item.parents.length; k++) {
                                itemInfo += '/' + item.parents[k];
                            }
                            itemInfo += '/\n' + brief(item.title) + '\n';
                            title += itemInfo;
                        }
                        chrome.pageAction.setTitle({tabId: tabIds[i], title: title});
                    } else {
                        chrome.pageAction.hide(tabIds[i]);
                        chrome.pageAction.setTitle({tabId: tabIds[i], title: '智能书签识别\n【当前网页未收藏】'});
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

function loadBookmarksTree(nodes, parentTitles) {
    parentTitles = parentTitles || [];
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.url) {
            var item = {
                parents: parentTitles,
                title: node.title,
                url: node.url
            };
            var key = normalizeUrl(node.url);
            var items = bookmarkMap[key];
            if (!items) {
                bookmarkMap[key] = [item];
            } else {
                items.push(item);
            }
        } else if (node.children) {
            var newTitles = [];
            newTitles.push.apply(newTitles, parentTitles);
            newTitles.push(node.title);
            loadBookmarksTree(node.children, newTitles);
        }
    }
}

function reloadContextMenu() {
    var targetUrlPatterns = [];
    for (var key in bookmarkMap) {
        if (/^.*:\/\/[^\/]*$/.test(key)) {
            targetUrlPatterns.push(key + '/*');
        } else {
            targetUrlPatterns.push(key + '*');
        }
    }
    chrome.contextMenus.removeAll(function () {
        chrome.contextMenus.create({
            id: 'bookmarkHelper-delete',
            type: 'normal',
            title: '已收藏',
            contexts: ['link'],
            // parentId: 0,
            targetUrlPatterns: targetUrlPatterns
        }, function () {
            var err = chrome.extension.lastError;
            if (err) {
                console.info('error', err);
            }
        });
    });
}

function reloadBookmarks() {
    console.info('reloadBookmarks', arguments);
    setTimeout(function () {
        bookmarkMap = {};
        chrome.bookmarks.getTree(function (tree) {
            loadBookmarksTree(tree);
            loadWindowList();
            reloadContextMenu();
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

chrome.contextMenus.onClicked.addListener(function (ev) {
    console.info('contextMenus.onClick', arguments);
});