chrome.runtime.sendMessage({eventName: 'getPopupContent'}, (response) => {
    const el = document.getElementById('popup_content');
    el.innerHTML = response;
    const aEls = document.getElementsByTagName('a');
    for (const aEl of aEls) {
        aEl.onclick = openNewWindow;
    }
});

function openNewWindow(event) {
    console.info('openNewWindow', arguments);
    chrome.tabs.create({url: event.target.href})
}
