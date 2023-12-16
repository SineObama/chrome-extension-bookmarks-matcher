/*
develop document: https://developer.chrome.com/docs/extensions
*/

/*GPT query:我想让你充当一个专业的Web前端软件工程师。我将提出与编程有关的问题，你将回答答案是什么。我希望你只回答给定的答案，在没有足够的细节时写出解释。以下是我的目前遇到的问题：我将使用当下流行的Manifest V3版本开发一个谷歌浏览器的拓展程序，核心要点如下：1.获取浏览器所有书签的地址，并且使用存储功能（storage）保存下来，以便后续功能使用；2.拓展程序读取用户打开的每个浏览器标签，根据标签地址给每个标签设置不同的拓展程序图标icon，判断方法是标签地址是否在书签中出现，未出现时使用icon1.png，有出现时使用icon2.png。3.拓展程序对每个浏览器标签都要生效，当用户切换到一个标签时，应该看到当前标签的情况，从而了解这个标签是否被收藏在书签中。4.当浏览器书签发生变化时，实时更新（storage中）保存的书签数据。（特别说明：以上功能我认为可以使用service worker脚本来实现，即在一个js文件中实现，请给出一套完整的核心js代码，同时，我不需要你解释其他比如manifest.json等简单的拓展程序配置方式）*/

// 获取浏览器所有书签
reloadBookmarks();

// 监听标签更新事件，更新拓展程序状态
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // url更新事件可能在用户角度会有所延迟，在性能不佳或者网站打不开的情况，会先看到网站地址，但是事件还没触发，需要再研究，但好像没有办法优化
    let url = changeInfo.url;
    if (!url) {
        return;
    }
    updateTabStatus(tabId, url, tab);
});

// 监听书签变化事件，更新保存的书签数据
chrome.bookmarks.onChanged.addListener(reloadBookmarks);
chrome.bookmarks.onRemoved.addListener(reloadBookmarks);
chrome.bookmarks.onCreated.addListener(reloadBookmarks);
chrome.bookmarks.onImportEnded.addListener(reloadBookmarks);

// 点击拓展图标时
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.eventName === 'getPopupContent' && chrome.runtime.id === sender.id) {
        chrome.tabs.query({active: true, lastFocusedWindow: true}, async ([tab]) => {
            console.info('getPopupContent', tab);
            const html = await _generatePopupContent(tab);
            sendResponse(html);
        });
        return true;
    }
});

/**
 * 根据标签url地址更新该标签中拓展的状态
 */
async function updateTabStatus(tabId, url, tab) {
    const {items, l2DomainItems} = await _matchUrl(url);

    // console.info(items, l2DomainItems);
    const matchSize = items.length;
    const l2DomainMatchSize = l2DomainItems.length;
    // 使用标记文本显示收藏的书签数量、域名关联的书签数量
    const active = matchSize > 0 || l2DomainMatchSize > 0;
    chrome.action.setBadgeText({
        text: active ? "" + matchSize + "-" + (l2DomainMatchSize > 99 ? 99 : l2DomainMatchSize) : "0",
        tabId: tabId
    }).catch(console.info); // 有时会出现找不到tabId的错误，无关紧要
    // 再使用文本背景色明显区分一下情况
    chrome.action.setBadgeBackgroundColor({
        // 有收藏时使用接近浏览器已收藏图标的绿色，只有域名时使用另一个颜色，没有时使用白色以明确表示
        color: matchSize > 0 ? "#00DD00" : l2DomainMatchSize > 0 ? "#00FBE0" : "#FFFFFF",
        tabId: tabId
    }).catch(console.info); // 有时会出现找不到tabId的错误，无关紧要
    // 所有页面都弹出提示，不关闭了
    // if (active) {
    //     chrome.action.enable(tabId);
    // } else {
    //     chrome.action.disable(tabId);
    // }
    // chrome.action.setIcon({path: {"128": 'iconPath'}, tabId: tabId});
    // 目前用360极速浏览器X还是无法正常显示title
    // chrome.action.setTitle({title: '', tabId: tabId});

}

/**
 * 获取url二级域名
 * @param {string} url
 * @return string
 */
function getL2Domain(url) {
    if (typeof url === 'string') {
        return url.replaceAll(/^https?:\/\/(?:[^\/]+\.)?([a-zA-Z]+)\.[a-zA-Z]+\/.*$/g, '$1')
    }
    return url;
}

/**
 * 标准化url，去掉query参数、末尾的斜杠
 * @param {string} url
 * @return string
 */
function normalizeUrl(url) {
    if (url) {
        const queryIdx = url.indexOf('?');
        if (queryIdx > 0) {
            url = url.substr(0, queryIdx);
        }
        if (url[url.length - 1] === '/') {
            url = url.substr(0, url.length - 1);
        }
    }
    return url;
}

/**
 * 递归扫描书签树，构建索引数据
 * @param {Object} data 插件数据
 * @param {BookmarkTreeNode[]} nodes
 * @param {string[]} [parentTitles]
 */
function loadBookmarksTree(data, nodes, parentTitles) {
    parentTitles = parentTitles || [];
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.url) {
            const item = {
                parents: parentTitles,
                title: node.title,
                url: node.url
            };
            _appendToMapNode(item, node.url, normalizeUrl, data.bookmarkMap);
            _appendToMapNode(item, node.url, getL2Domain, data.bookmarkL2DomainMap);
        } else if (node.children) {
            const newTitles = [];
            newTitles.push.apply(newTitles, parentTitles);
            newTitles.push(node.title);
            loadBookmarksTree(data, node.children, newTitles);
        }
    }
}

/**
 * 重新生成上下文菜单（右键菜单）
 * @param {Object} data 插件数据
 */
function reloadContextMenu(data) {
    const targetUrlPatterns = [];
    for (let key in data.bookmarkMap) {
        if (/^.*:\/\/[^\/]*$/.test(key)) {
            targetUrlPatterns.push(key + '/*');
        } else {
            targetUrlPatterns.push(key + '*');
        }
    }
    chrome.contextMenus.removeAll(() => {
        // 点击链接时判断链接是否已收藏
        chrome.contextMenus.create({
            id: 'bookmarkHelper-delete',
            type: 'normal',
            title: chrome.i18n.getMessage("bookmarked"),
            contexts: ['link'],
            // parentId: 0,
            targetUrlPatterns: targetUrlPatterns
        }, () => {
            const err = chrome.extension.lastError;
            if (err) {
                console.info('error', err);
            }
        });
    });
}

// 为处理书签变更，尝试过使用标签切换事件 chrome.tabs.onActivated 但发现360极速浏览器X中鼠标点击标签不会触发此事件，只能另外考虑直接更新所有标签
// chrome.tabs.onActivated.addListener(activeInfo => {
//     chrome.tabs.get(activeInfo.tabId, tab => {
//         if (!tab) {
//             console.warn('get tab fail:', activeInfo)
//             return;
//         }
//         updateTabStatus(tab.url, tab.id);
//     });
// });
/**
 * 重新加载书签内容，生成索引数据
 */
function reloadBookmarks() {
    chrome.bookmarks.getTree(tree => {
        const data = {bookmarkMap: {}, bookmarkL2DomainMap: {}};
        loadBookmarksTree(data, tree);
        reloadContextMenu(data);
        chrome.storage.local.set(data, updateAllTabs);
    });
}

function updateAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        for (let i = 0; i < tabs.length; i++) {
            updateTabStatus(tabs[i].id, tabs[i].url, tabs[i]);
        }
    });
}

/**
 * 按照本拓展的数据结构，对Map节点添加新的数据
 * @param {Object} item 新的数据
 * @param {string} url 地址
 * @param {function(url: string): string} urlToKey 地址转换为Map的key的方法
 * @param {Object} dataMap Map数据
 * @private
 */
function _appendToMapNode(item, url, urlToKey, dataMap) {
    const key = urlToKey(url);
    const items = dataMap[key];
    if (!items) {
        dataMap[key] = [item];
    } else {
        items.push(item);
    }
}

/**
 * 从数组中排除已存在的url
 * @param {Object[]} array 被处理的数组
 * @param {Object[]} existArray 代表已存在数据的数组
 * @private
 */
function _excludeUrls(array, existArray) {
    for (let i = 0; i < array.length; i++) {
        const l2DomainItem = array[i];
        for (const item of existArray) {
            if (item.url === l2DomainItem.url) {
                array.splice(i, 1);
                i--;
                break;
            }
        }
    }
}

/**
 * 生成popup窗口的html内容，列出收藏夹中的关联内容
 * @param tab
 * @return {Promise<string>}
 * @private
 */
async function _generatePopupContent(tab) {
    let {items, l2DomainItems} = await _matchUrl(tab.url);
    if (!items.length && !l2DomainItems.length) {
        return `【${chrome.i18n.getMessage("tab_not_bookmarked")}】`;
    }
    let title = items.length > 0 && l2DomainItems > 0 ? `【${chrome.i18n.getMessage("matched_rule_1_2")}】` : items.length > 0 ? `【${chrome.i18n.getMessage("matched_rule_1")}】` : `【${chrome.i18n.getMessage("matched_rule_2")}】`;
    let html = `<h3>${title}</h3>`;
    html += _generateBookmarksPart(items, 5, chrome.i18n.getMessage("rule_1_result_title"));
    html += _generateBookmarksPart(l2DomainItems, 99, chrome.i18n.getMessage("rule_2_result_title"));
    return html;
}

/**
 * 识别地址，返回结果
 * @param {string} url 地址
 * @return {Promise<{l2DomainItems: Object[], items: Object[]}>}
 * @private
 */
async function _matchUrl(url) {
    const data = await chrome.storage.local.get(["bookmarkMap", "bookmarkL2DomainMap"]);

    const bookmarkMap = data.bookmarkMap || {};
    const bookmarkL2DomainMap = data.bookmarkL2DomainMap || {};
    const items = bookmarkMap[normalizeUrl(url)] || [];
    const l2DomainItems = bookmarkL2DomainMap[getL2Domain(url)] || [];

    _excludeUrls(l2DomainItems, items);

    return {items, l2DomainItems};
}

/**
 * 生成一组收藏夹html
 * @param {Object[]} items
 * @param {number} maxShow
 * @param {string} name
 * @return {string}
 * @private
 */
function _generateBookmarksPart(items, maxShow, name) {
    const prefix = items.length > 0 ? `<h4>====${name}====</h4>` : '';
    let postfix = '';
    // 限制展示数量
    if (items.length > maxShow) {
        items = items.slice(0, maxShow);
        postfix = '<p><b>......(more)</b></p>';
    }
    return prefix + _appendBookmarkDescrption(items) + postfix;
}

/**
 * 生成若干收藏夹内容的html
 * @param {Object[]} items
 * @return {string}
 * @private
 */
function _appendBookmarkDescrption(items) {
    let text = '';
    for (let j = 0; j < items.length; j++) {
        const item = items[j];
        let itemPath = '';
        for (let k = 0; k < item.parents.length; k++) {
            itemPath += '/' + item.parents[k];
        }
        itemPath += '/';
        text += `<p>${itemPath}<br /><b>${item.title}</b><br /><a href="${item.url}">${item.url}</a></p>`;
    }
    return text;
}
