# bookmarks matcher (Chrome extension)

Show the bookmarks related to the current tab URL: 

1. Match bookmarks ignoring URL parameters and tailing slash.
2. Match with the same second-level domain.
3. Prompt the quantity of the matched result, click to view details and jump.
4. Prompt using rule 1 when right click on links.

ISSUES: 

- some websites like single-page may be misjudged because of the first rule.

**BACKGROUND**: 

- Browser can prompt whether a webpage is bookmarked, but it only matches the whole URL. Nowadays, many URLs contains dynamic or random _query string_ or _fragment identifier_(hash), or an optional trailing slash. When we forget whether it is bookmarked, those differences make us difficult to judge, we can only search it. In this case, we need a convenient matcher.
- When we even forget whether we have bookmarked a page from a website, we may need this extension. Usually we only need to look at the second-level domain, considering some website authors may use different top-level domains such as _abc.org_ and _abc.io_.
