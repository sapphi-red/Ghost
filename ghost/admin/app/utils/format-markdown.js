import markdownit from 'markdown-it';
import markdownitFootnote from 'markdown-it-footnote';
import markdownitLazyHeaders from 'markdown-it-lazy-headers';
import markdownitMark from 'markdown-it-mark';
import markdownitSubscript from 'markdown-it-sub';
import markdownitSuperscript from 'markdown-it-sup';
import {createHighlightFunc, katexPlugin, useContainer} from '@traptitech/traq-markdown-it';
import {sanitizeHtml} from 'koenig-editor/helpers/sanitize-html';

let slugify = function slugify(inputString, usedHeaders) {
    let slug = inputString.replace(/[^\w]/g, '').toLowerCase();
    if (usedHeaders[slug]) {
        usedHeaders[slug] += 1;
        slug += usedHeaders[slug];
    }
    return slug;
};

// originally from https://github.com/leff/markdown-it-named-headers
// moved here to avoid pulling in http://stringjs.com dependency
let markdownitNamedHeaders = function markdownitNamedHeaders(md) {
    let originalHeadingOpen = md.renderer.rules.heading_open;

    // eslint-disable-next-line camelcase
    md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
        let usedHeaders = {};

        tokens[idx].attrs = tokens[idx].attrs || [];

        let title = tokens[idx + 1].children.reduce(function (acc, t) {
            return acc + t.content;
        }, '');

        let slug = slugify(title, usedHeaders);
        tokens[idx].attrs.push(['id', slug]);

        if (originalHeadingOpen) {
            return originalHeadingOpen.apply(this, arguments);
        } else {
            return self.renderToken(...arguments);
        }
    };
};

let md = markdownit({
    highlight: createHighlightFunc('blog-code'),
    html: true,
    breaks: true,
    linkify: true
})
    .use(markdownitFootnote)
    .use(markdownitLazyHeaders)
    .use(markdownitMark)
    .use(markdownitNamedHeaders)
    .use(markdownitSubscript)
    .use(markdownitSuperscript);

// configure linkify-it
md.linkify.set({
    fuzzyLink: false
});
md.use(katexPlugin, {
    output: 'html'
});
useContainer(md);

export default function formatMarkdown(_markdown, replaceJS = true) {
    let markdown = _markdown || '';
    let escapedhtml = '';

    // convert markdown to HTML
    escapedhtml = md.render(markdown);

    // avoid sanitizing svg
    let buf = [];
    escapedhtml = escapedhtml.replace(/<svg[\s\S]+?\/svg>/g, m => `#math${buf.push(m)}#`);

    // sanitize html
    escapedhtml = sanitizeHtml(escapedhtml, {replaceJS});

    // restore svg
    escapedhtml = escapedhtml.replace(/#math(\d+)#/g, (m, i) => buf[parseInt(i) - 1]);

    return escapedhtml;
}
