// Generated by CoffeeScript 1.8.0
var IGNORE_ATTRIBUTES, REGEXP, allowedAttributes, allowedSchemes, allowedTags, flattenMailboxTreeLevel, safeAttributes, sanitizeHtml, _;

_ = require('lodash');

sanitizeHtml = require('sanitize-html');

REGEXP = {
  hasReOrFwD: /^(Re|Fwd)/i,
  subject: /(?:(?:Re|Fwd)(?:\[[\d+]\])?\s?:\s?)*(.*)/i,
  messageID: /<([^<>]+)>/
};

IGNORE_ATTRIBUTES = ['\\HasNoChildren', '\\HasChildren'];

allowedTags = sanitizeHtml.defaults.allowedTags.concat(['img', 'head', 'meta', 'title', 'link', 'h1', 'h2', 'h3', 'h4']);

safeAttributes = ['style', 'class', 'background', 'bgcolor', 'colspan', 'rowspan', 'height', 'width', 'align', 'font-size', 'cellpadding', 'cellspacing', 'border', 'valign', 'leftmargin', 'marginwidth', 'topmargin', 'marginheight', 'offset', 'itemscope', 'itemtype', 'itemprop', 'content'];

allowedAttributes = sanitizeHtml.defaults.allowedAttributes;

allowedTags.forEach(function(tag) {
  var exAllowed;
  exAllowed = allowedAttributes[tag] || [];
  return allowedAttributes[tag] = exAllowed.concat(safeAttributes);
});

allowedAttributes.link.push('href');

allowedSchemes = sanitizeHtml.defaults.allowedSchemes.concat(['cid', 'data']);

module.exports = {
  isReplyOrForward: function(subject) {
    var match;
    match = subject.match(REGEXP.hasReOrFwD);
    if (match) {
      return true;
    } else {
      return false;
    }
  },
  normalizeSubject: function(subject) {
    var match;
    match = subject.match(REGEXP.subject);
    if (match) {
      return match[1];
    } else {
      return false;
    }
  },
  normalizeMessageID: function(messageID) {
    var match;
    match = messageID.match(REGEXP.messageID);
    if (match) {
      return match[1];
    } else {
      return messageID;
    }
  },
  flattenMailboxTree: function(tree) {
    var boxes, delimiter, path, root;
    boxes = [];
    if (Object.keys(tree).length === 1 && tree['INBOX']) {
      root = tree['INBOX'];
      delimiter = root.delimiter;
      path = 'INBOX' + delimiter;
      boxes.push({
        label: 'INBOX',
        delimiter: delimiter,
        path: 'INBOX',
        tree: ['INBOX'],
        attribs: _.difference(root.attribs, IGNORE_ATTRIBUTES)
      });
      flattenMailboxTreeLevel(boxes, root.children, path, [], delimiter);
    } else {
      flattenMailboxTreeLevel(boxes, tree, '', [], '/');
    }
    return boxes;
  },
  sanitizeHTML: function(html, messageId, attachments) {
    return sanitizeHtml(html, {
      allowedTags: allowedTags,
      allowedAttributes: allowedAttributes,
      allowedClasses: false,
      allowedSchemes: allowedSchemes,
      transformTags: {
        'img': function(tag, attribs) {
          var attachment, cid, mime, name, src, _ref, _ref1;
          if ((attribs.src != null) && 0 === attribs.src.indexOf('cid:')) {
            cid = attribs.src.substring(4);
            attachment = attachments.filter(function(att) {
              return att.contentId === cid;
            });
            if ((_ref = attachment[0]) != null ? _ref.fileName : void 0) {
              name = (_ref1 = attachment[0]) != null ? _ref1.fileName : void 0;
              src = "message/" + messageId + "/attachments/" + name;
              attribs.src = src;
            } else {
              attribs.src = "";
            }
          }
          if ((attribs.src != null) && 0 === attribs.src.indexOf('data:')) {
            mime = /data:([^\/]*)\/([^;]*);/.exec(attribs.src);
            if ((mime == null) || mime[1] !== 'image') {
              attribs.src = "";
            }
          }
          return {
            tagName: 'img',
            attribs: attribs
          };
        }
      }
    });
  }
};

flattenMailboxTreeLevel = function(boxes, children, pathStr, pathArr, parentDelimiter) {
  var child, delimiter, name, subPathArr, subPathStr, _results;
  _results = [];
  for (name in children) {
    child = children[name];
    delimiter = child.delimiter || parentDelimiter;
    subPathStr = pathStr + name + delimiter;
    subPathArr = pathArr.concat(name);
    flattenMailboxTreeLevel(boxes, child.children, subPathStr, subPathArr, delimiter);
    _results.push(boxes.push({
      label: name,
      delimiter: delimiter,
      path: pathStr + name,
      tree: subPathArr,
      attribs: _.difference(child.attribs, IGNORE_ATTRIBUTES)
    }));
  }
  return _results;
};