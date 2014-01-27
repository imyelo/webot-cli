var xml2js = require('xml2js');
var xmlParser = new xml2js.Parser();
var _ = require('lodash')._;
var supertest = require('supertest');
var crypto = require('crypto');
var url = require('url');

var exports = {};

var defaultsInfo = {
  sp: 'webot',
  user: 'client',
  type: 'text',
  text: 'help',
  pic: 'http://www.baidu.com/img/baidu_sylogo1.gif',
  lat: '23.08',
  lng: '113.24',
  scale: '20',
  label: 'this is a location'
};

/**
 * @method makeAuthQuery 组装querystring
 * @param {String} token 在微信公共平台后台填入的 token
 */
exports.makeAuthQuery = function (token, timestamp, nonce){
  var obj = {
    token: token,
    timestamp: timestamp || new Date().getTime().toString(),
    nonce: nonce || parseInt((Math.random() * 10e10), 10).toString(),
    echostr: 'echostr_' + parseInt((Math.random() * 10e10), 10).toString()
  };

  var s = [obj.token, obj.timestamp, obj.nonce].sort().join('');
  obj.signature = crypto.createHash('sha1').update(s).digest('hex');
  return obj;
};

/**
 * @property {String} tpl XML模版
 */
exports.info2xml = _.template([
  '<xml>',
    '<ToUserName><![CDATA[<%= sp %>]]></ToUserName>',
    '<FromUserName><![CDATA[<%= user %>]]></FromUserName>',
    '<CreateTime><%= Math.round(new Date().getTime() / 1000) %></CreateTime>',
    '<MsgType><![CDATA[<%= type %>]]></MsgType><% if(type=="text"){ %>',
      '<Content><![CDATA[<%= text %>]]></Content>',
    '<% }else if(type=="location"){ %>',
      '<Location_X><%= lat %></Location_X>',
      '<Location_Y><%= lng %></Location_Y>',
      '<Scale><%= scale %></Scale>',
      '<Label><![CDATA[<%= label %>]]></Label>',
    '<% }else if(type=="event"){  %>',
      '<Event><![CDATA[<%= event %>]]></Event>',
      '<EventKey><![CDATA[<%= eventKey %>]]></EventKey>',
    '<% }else if(type=="link"){  %>',
      '<Title><![CDATA[<%= title %>]]></Title>',
      '<Description><![CDATA[<%= description %>]]></Description>',
      '<Url><![CDATA[<%= url %>]]></Url>',
    '<% }else if(type=="image"){  %>',
      '<PicUrl><![CDATA[<%= pic %>]]></PicUrl>',
    '<% } %></xml>'
].join('\n'));


var Send = function (options) {
  if (!(this instanceof Send)) {
    return new Send(options);
  }

  this._options = _.defaults(options, {
    host: '127.0.0.1',
    port: 80,
    route: '/',
    token: 'keyboardcat123',
    sp: 'webot',
    user: 'client'
  });

  var urlObj;

  if (!options.app) {
    if (this._options.url) {
      urlObj = url.parse(this._options.url);
      this._options.host = urlObj.hostname;
      this._options.port = urlObj.port;
      this._options.route = urlObj.pathname + (urlObj.search || '');
    } else {
      this._options.url = 'http://' + options.host + ':' + options.port + options.route;
    }
  }

  return this;
};

Send.prototype._request = function (info, cb) {
  var qs = exports.makeAuthQuery(this._options.token);
  var app, route, url, req;
  if (this._options.app) {
    app = this._options.app;
    route = this._options.route;
  } else {
    url = 'http://' + this._options.host + ':' + this._options.port;
    route = this._options.route;
  }

  //默认值
  _.defaults(info, {
    sp: this._options.sp,
    user: this._options.user
  }, defaultsInfo);

  var content = exports.info2xml(info);

  var wrapper = function(err, res, body){
    if (err || res.statusCode == '403' || !(body = body || res.text)){
      cb(err || res.statusCode, body);
    } else {
      try {
        xmlParser.parseString(body, function(err, result){
          if (err || !result || !result.xml) {
            err = err || new Error('result format incorrect');
            err.raw = body;
            cb(err, result);
          } else {
            var json = result.xml;

            if (json.MsgType == 'news') {
              json.ArticleCount = Number(json.ArticleCount);
            }

            cb(err, json);
          }
        });
      } catch (e) {
      }
    }
  };
  
  //发送请求
  supertest((app || url)).post(route).query(qs).send(content).end(wrapper);

  return content;
};

Send.prototype.text = function (text, cb) {
  this._request({
    text: text,
    type: 'text'
  }, cb);
};

Send.prototype.image = function (pic, cb) {
  this._request({
    pic: pic,
    type: 'image'
  }, cb);
};

Send.prototype.location = function (lat, lng, label, cb) {
  this._request({
    lat: lat,
    lng: lng,
    label: label,
    type: 'location'
  }, cb);
};

Send.prototype.event = function (event, eventKey, cb) {
  this._request({
    event: event,
    eventKey: eventKey,
    type: 'event'
  }, cb);
};

exports.Send = Send;

module.exports = exports;