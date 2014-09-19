"use strict";
/*
 * NoCancer server app.
 *
 * Usage: node bin/server.js
 */

var config = require('./config/config.js');

var connect = require('connect');
var fs = require('fs');
var path = require('path');
var zlib = require("zlib");
var qs = require('querystring');
var url = require('url');

// global variables
//下载网站所在的目录

var ROOT_PATH = path.join(__dirname,  config.working_root_path);
var archivePath = path.join(ROOT_PATH, config.host);
console.log('Working path:', archivePath);

var parseRange = function (str, size) {
  if (str.indexOf(",") !== -1) {
    return;
  }

  var range = str.split("-"),
  start = parseInt(range[0], 10),
  end = parseInt(range[1], 10);

  // Case: -100
  if (isNaN(start)) {
    start = size - end;
    end = size - 1;
    // Case: 100-
  } else if (isNaN(end)) {
    end = size - 1;
  }

  // Invalid
  if (isNaN(start) || isNaN(end) || start > end || end > size) {
    return;
  }

  return {start: start, end: end};
};

var decode = function (str) {
  return (new Buffer(str, 'base64')).toString();
};

var getAttFilePath = function(uriObj){ 
  var realIdArray = decode(uriObj.query.aid).split('|');
  console.log('realId.array: ', realIdArray);
  console.log('16num to 10', parseInt(realIdArray[1], 16));

  var filename = Object.keys(uriObj.query).reduce(function (pre, current, index) {
    console.log(index, 'current:', current, 'pre:', pre);
    //Add other param to filenameArray
    if (!/(mod|aid)/i.test(current)) {
      pre.push(current);
    }
    return pre;
  }, [realIdArray.shift()]);

  console.log('realId.array: ', realIdArray);
  console.log('filename:', filename);

  return path.join('attachment', realIdArray.pop(), filename.join('-'));
};

var webServer = connect()
.use(connect.logger(':method :url - :res[content-type]', { buffer: 5000 }))
.use(function (req, res, next) {
  if (req.url === '/') {
    req.url = config.defaultPage;
  }
  next();
});

//attachments parse
webServer.use(function (req, res, next) {
  if (/\/forum.php\?mod=attachment&aid/.test(req.url)) {
    var urlstr = 'http://' + config.host + req.url;
    console.log('attachement url:', urlstr);
    var filePath = path.join(archivePath, getAttFilePath(url.parse(urlstr, true)));

    //attachment/id-noupdate-nothumb files was removed.
    filePath = filePath.replace('noupdate-nothumb', 'nothumb');

    req.filePath = filePath;
    console.log('get attachment', filePath);
  }
  next();
});

//xhr from js return true allways to fix client js error.
webServer.use(function (req, res, next) {
  if (req.url === '/connect.php?mod=check&op=cookie') {
    res.setHeader('content-type', 'text/plain');
    res.end('true');
  } else {
    next();
  }
});

//archiver 資源處理
webServer.use(function (req, res, next) {
  if (req.url === '/archiver/') {
    req.filePath = path.join(archivePath, 'archiver/index.html');
  }


  next();
});

//formdisplay
webServer.use(function (req, res, next) {
  // /forum.php?mod=forumdisplay&fid=16&page=1
  if (/^\/forum.php\?mod=forumdisplay/.test(req.url)) {
    res.setHeader('Content-Type', 'text/html');
    var qsObj = qs.parse(req.url);
    var url = 'forum-' + qsObj['fid'] + '-' + qsObj['page'] + '.html';
    req.filePath = path.join(archivePath, url);
  }
  next();
});

//thread display
//example URI : "/forum.php?mod=viewthread&tid=9734&page=2"
webServer.use(function (req, res, next) {
  if (/^\/forum.php\?mod=viewthread/.test(req.url)) {
    res.setHeader('Content-Type', 'text/html');
    var qsObj = qs.parse(req.url);
    var url = 'thread-' + qsObj['tid'] + '-' + qsObj['page'] + '-1.html';
    req.filePath = path.join(archivePath, url);
  }
  next();
});

//avatar picture
webServer.use(function (req, res, next) {//ucenter avatar images
  if (/^\/ucenter/.test(req.url)) {
    res.setHeader("Content-Type", "image/jpg");
    req.filePath = path.join(archivePath, req.url);
    console.log('Read file:', req.filePath);
  }
  next();
});

//other crawled url parse
webServer.use(function (req, res, next) {
  if (/\.(php)$/.test(req.url) ||
      /^\/home\.php\?mod=space&uid=\d{1,6}$/.test(req.url) ||
        /forum\.php\?gid=/.test(req.url) ||
          /group\.php?gid=/.test(req.url) ||
            /^\/archiver\/\?/.test(req.url)) {
    res.setHeader("Content-Type", 'text/html; charset="utf-8"');
  req.filePath = path.join(archivePath, req.url);
  }

  if (/\.html$/.test(req.url)) {
    res.setHeader("Content-Type", 'text/html; charset="utf-8"');
    req.filePath = path.join(archivePath, req.url);
  }

  if(/\.css$/.test(req.url)){
    req.filePath = path.join(__dirname,'../template/css.css');
  }

  console.log('req.filePath:', req.filePath);
  next();
});

//For crawled static files
webServer.use(
  //Some codes from JacksonTian's ping module.(https://github.com/JacksonTian/ping)
  function (request, response, next) {//static server
  if (request.filePath) {
    fs.stat(request.filePath, function (err, stats) {
      if (err) {
        next(err);
        return;
      }
      //maybe (Inaction) when use gzip the file size is not sutable.
      //response.setHeader('Content-Length', stats.size);

      var lastModified = stats.mtime.toUTCString();
      var ifModifiedSince = "If-Modified-Since".toLowerCase();
      response.setHeader("Last-Modified", lastModified);

      var expires = new Date();
      var maxAge = 3600 * 12 * 360 * 1000;
      expires.setTime(expires.getTime() + maxAge);
      response.setHeader("Expires", expires.toUTCString());
      response.setHeader("Cache-Control", "max-age=" + maxAge);

      if (request.headers[ifModifiedSince] && lastModified === request.headers[ifModifiedSince]) {
        response.writeHead(304, "Not Modified");
        console.log('304 not modified.');
        response.end();
      } else {
        var compressHandle = function (raw, statusCode, reasonPhrase) {
          var stream = raw;
          var acceptEncoding = request.headers['accept-encoding'] || "";
          var matched = true;//

          if (matched && acceptEncoding.match(/\bgzip\b/)) {
            response.setHeader("Content-Encoding", "gzip");
            stream = raw.pipe(zlib.createGzip());
          } else if (matched && acceptEncoding.match(/\bdeflate\b/)) {
            response.setHeader("Content-Encoding", "deflate");
            stream = raw.pipe(zlib.createDeflate());
          }
          response.writeHead(statusCode, reasonPhrase);
          stream.pipe(response);
        };

        var raw;
        if (request.headers["range"]) {
          var range = parseRange(request.headers["range"], stats.size);
          if (range) {
            response.setHeader("Content-Range", "bytes " + range.start + "-" + range.end + "/" + stats.size);
            response.setHeader("Content-Length", (range.end - range.start + 1));
            raw = fs.createReadStream(request.filePath, {"start": range.start, "end": range.end});
            compressHandle(raw, 206, "Partial Content");
          } else {
            response.removeHeader("Content-Length");
            response.writeHead(416, "Request Range Not Satisfiable");
            response.end();
          }
        } else {
          raw = fs.createReadStream(request.filePath);
          compressHandle(raw, 200, "Ok");
        }
      }

    });

  } else {
    next();
  }
});

//Static files;
webServer.use(connect.static(archivePath));

//tail router.
webServer.use(function (req, res) {
  console.error('url 404:', req.url);
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain');
  res.end('URI : "' + req.url + '" NOT crawled from ' + config.host);
});

//start server
webServer.listen(config.port);
console.log("Crawler site server started at port:", config.port);
console.log("Waiting for connection ...");

