const express = require('express');
const router = express.Router();
const snoowrap = require('snoowrap');
const _ = require('lodash');
const config = require('../config');
const aws = require('aws-sdk');
aws.config.update(config.aws);

const db = new aws.DynamoDB.DocumentClient();
const reddit = new snoowrap(config.reddit);
reddit.config({requestDelay: 100});

function parseSelfPost(post) {
  if (post.is_self) {
    var domains = [];
    post.selftext.replace(
      /https?:\/\/([^/]+)\//g,
      (match, domain) => domains.push({domain: domain})
    );
    return domains;
  }
  return post;
}

function getAggregatedData(subreddit, listing) {
  return _(listing)
    .map(parseSelfPost)
    .flatten()
    .map('domain')
    .map(domain => domain.replace('www.', ''))
    .countBy()
    .toPairs()
    .orderBy(1, 'desc')
    .value()
}

function saveAndReturnData(subreddit, data) {
  var item = {
    subreddit: subreddit,
    expires: Date.now() + (7 * 24 * 60 * 60 * 1000),
    data: data
  };
  return db.put(
    {
      TableName: 'subdomain', 
      Item: item
    }, function () {
      console.error(arguments);
    }
  ).promise().then(function () {
    return item;
  });
}

function ifEmptyRetrieveFromRedditAndSave(subreddit, result) {
  if (!result.Item || result.Item.expires < Date.now()) {
    return reddit
      .getSubreddit(subreddit)
      .getTop({time: 'month'})
      .fetchMore({amount: 500})
      .then(_.curry(getAggregatedData)(subreddit))
      .then(_.curry(saveAndReturnData)(subreddit))
      .catch(function (){
        console.error(arguments);
      });
  }
  return result.Item;
}

function getFromDb(subreddit) {
  return db.get({
    TableName: 'subdomain',
    Key: {subreddit: subreddit}
  }).promise();
}

function getSubreddit(subreddit) {
  return getFromDb(subreddit)
    .then(_.curry(ifEmptyRetrieveFromRedditAndSave)(subreddit));
}

function getData(subreddits) {
  if (subreddits[0] === '') { return Promise.resolve([]); }
  return Promise.all(subreddits.map(getSubreddit));
}

router.get('/r/\*', function(req, res, next) {
  const subreddits = req.path.substr(3).split('+');
  getData(subreddits).then(function (data) {
    res.render('index', { subreddits: subreddits, charts: data });
  });
});

module.exports = router;
