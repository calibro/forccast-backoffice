var express = require('express');
var request = require('request');
var config = require('../config/config.js');
var fs = require('fs');
var async = require('async');
var router = express.Router();

var normalizeDigits = function(num) {
  var str = '' + num;
  return str.length > 1 ? str : '0' + str;
}

var formatContent = function(html) {
  return html
          .replace(/\n/g, '<br />')
}


/* GET events listing. */
router.get('/', function(req, res) {

  var url = 'https://www.googleapis.com/calendar/v3/calendars/' + config.api.calendar.calendarId + '/events';
  var params = {
    key: config.api.calendar.apiKey,
    timeMin: new Date()
  };

  request(
    { url: url, qs: params},
    function (error, response, body) {
    if (!error && response.statusCode == 200) {

      var json = JSON.parse(body);

      json = json.items;

      var json_fr = [],
          json_en = [];

      json.forEach(function(e){

        var hasDateTime = e.start.dateTime !== undefined ? true : false;

        var start = hasDateTime ? e.start.dateTime : e.start.date;
        var end = hasDateTime ? e.end.dateTime : e.end.date;
        const HOUR = 3600 * 1000;
        var DAY = HOUR * 24;
        // if time of end is 00:00 --> -1day
        if (start && end && new Date(end).getHours() === 2) {
          var diff = Math.abs(new Date(end).getTime() - new Date(start).getTime());
          if (diff%DAY === 0) {
            end = new Date(end)
            end = end.getFullYear() + '-' + normalizeDigits(end.getMonth() + 1) + '-' + (end.getDate() - 1);
          }
        }
        // if no time specified, reduce end by one day (google agenda probably sets end at day+1 00:00 ...)
        if (start && end && !hasDateTime) {
          end = new Date(end)
          end = end.getFullYear() + '-' + normalizeDigits(end.getMonth() + 1) + '-' + (end.getDate() - 1);
        }

        var summary_fr = formatContent(e.summary && e.summary.length ? e.summary.split('|')[0] : e.summary);
        var description_fr = formatContent(e.description && e.description.length ? e.description.split('|')[0] : e.description);

        var elm_fr = {
          htmlLink: e.htmlLink,
          location: e.location,
          start,
          end,
          hasDateTime: hasDateTime,
          hangoutLink: e.hangoutLink,
          summary: summary_fr,
          description: description_fr
        }

        json_fr.push(elm_fr);

        var summary_en = formatContent(e.summary && e.summary.length ? e.summary.split('|').length>1?e.summary.split('|')[1]:e.summary.split('|')[0] : e.summary);
        var description_en = formatContent(e.description && e.description.length ?  e.description.split('|').length>1?e.description.split('|')[1]:e.description.split('|')[0] : e.description);


        var elm_en = {
          htmlLink: e.htmlLink,
          location: e.location,
          start: start,
          end: end,
          hasDateTime: hasDateTime,
          hangoutLink: e.hangoutLink,
          summary: summary_en,
          description: description_en
        }

        json_en.push(elm_en);

      });
      json_fr = json_fr.sort(function(a, b) {
        if (a.start > b.start) {
          return -1;
        }
        return 1;
      })
      json_en = json_en.sort(function(a, b) {
        if (a.start > b.start) {
          return -1;
        }
        return 1;
      });

      var files = [
        {lang:'fr', content: json_fr},
        {lang:'en', content: json_en}
      ]

      async.each(files, function (file, callback) {

          fs.writeFile(config.api.calendar.path + 'calendar_' + file.lang +'.json', JSON.stringify(file.content, null, 4), function (err) {
              if(err){
                callback(err);
              }else{
                callback();
              }
          });

      }, function (err) {

          if (err) {
              res.send({status:'error', message:err});
          }
          else {
              res.send({status:'ok', message:'The files were saved!'})
          }
      });

    } else{
      var msg = {status:'error', message: error?error:body}
      res.send(msg)
    }
  })

});

module.exports = router;
