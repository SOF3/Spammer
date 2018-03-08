/*
 * Copyright (C) 2018 Nathaniel Fredericks
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the Mozilla Public License as published by
 * Mozilla, either version 2 of the License, or
 * (at your option) any later version.
 */
var crypto = require('crypto')
var express = require('express')
var app = express()
var fs = require('fs')
var yaml = require('js-yaml')
var bodyParser = require('body-parser')
var jwt = require('jsonwebtoken')
var call = require('request')
const ERROR_MESSAGE = {
    success: false,
    message: 'This webhook has experienced an error while processing the request.'
}
const NOT_ADDED_MESSAGE = {
    success: false,
    message: 'The webhook currently has not implemented this type yet.'
}
const PING_MESSAGE = {
    success: true,
    message: 'The webhook has been successfully pinged.'
}
const INVALID_CRED_MESSAGE = {
    success: false,
    message: 'The webhook credentials are invaid or not present.'
}
const SUCCESS_MESSAGE = {
    success: true,
    message: 'This webhook has successfully delivered the request.'
}
app.use(bodyParser.json())
app.post('/webhook', (req, res) => {
    if ('sha1=' + crypto.createHmac('sha1', String(process.env.GITHUB_WEBHOOK)).update(JSON.stringify(req.body)).digest('hex') !== req.get('X-Hub-Signature')) {
        return res.status(401).json(INVALID_CRED_MESSAGE)
    }
    switch (req.get('X-GitHub-Event')) {
        case 'ping':
            res.status(200).json(PING_MESSAGE)
            break
        case 'issues':
            if (req.body.action === 'edited') {
                if (req.body.changes.title && req.body.issue.title === '!spam') {
                    jwt.sign({
                        iat: parseInt(new Date().getTime() / 1e3),
                        exp: parseInt(new Date(new Date().getTime() + 10 * 60 * 1e3) / 1e3),
                        iss: process.env.GITHUB_ISS
                    }, fs.readFileSync('.data/spammer.pem'), {
                        algorithm: 'RS256'
                    }, (err, token) => {
                        if (err) {
                            return res.status(500).json(ERROR_MESSAGE)
                        } else {
                            var options = {
                                url: 'https://api.github.com/installations/' + req.body.installation.id + '/access_tokens',
                                method: 'POST',
                                headers: {
                                    'User-Agent': 'spammer/0.1.0',
                                    Accept: 'application/vnd.github.machine-man-preview+json',
                                    Authorization: 'Bearer ' + token
                                }
                            }
                            call(options, (err, tokenResponse) => {
                                if (err) {
                                    return res.status(500).json(ERROR_MESSAGE)
                                } else {
                                    var options = {
                                        url: 'https://api.github.com/repos/' + req.body.repository.full_name + '/contents/.github/spammer.yml?ref=master',
                                        method: 'GET',
                                        headers: {
                                            'User-Agent': 'spammer/0.1.0',
                                            Authorization: 'Bearer ' + JSON.parse(tokenResponse.body).token,
                                            'Accept': 'application/json'
                                        }
                                    }
                                    call(options, (err, configResponse) => {
                                        if (err) {
                                            return res.status(500).json(ERROR_MESSAGE)
                                        }
                                        var config = yaml.safeLoad(new Buffer(JSON.parse(configResponse.body).content || new Buffer(`
                                          title: "${req.body.changes.title.from}"
                                          body: "${req.body.issue.body}"
                                        `).toString('base64'), 'base64').toString()) // This will parse the yaml contents
                                        var options = {
                                            url: 'https://api.github.com/repos/' + req.body.repository.full_name + '/issues/' + req.body.issue.number + '/comments',
                                            method: 'GET',
                                            headers: {
                                                'User-Agent': 'spammer/0.1.0',
                                                Authorization: 'Bearer ' + JSON.parse(tokenResponse.body).token,
                                                'Accept': 'application/json'
                                            }
                                        }
                                        // ^ Get all comments on a issue
                                        call(options, (err, commentsResponse) => {
                                            if (err) {
                                                return res.status(500).json(ERROR_MESSAGE)
                                            }
                                            JSON.parse(commentsResponse.body).forEach(comment => {
                                                var options = {
                                                    url: 'https://api.github.com/repos/' + req.body.repository.full_name + '/issues/comments/' + comment.id,
                                                    method: 'DELETE',
                                                    headers: {
                                                        'User-Agent': 'spammer/0.1.0',
                                                        Authorization: 'Bearer ' + JSON.parse(tokenResponse.body).token,
                                                        'Accept': 'application/json'
                                                    }
                                                }
                                                call(options, err => {
                                                    if (err) {
                                                        return res.status(500).json(ERROR_MESSAGE)
                                                    }
                                                })
                                            })
                                            // ^ Loop through all comments and delete them by id
                                            var options = {
                                                url: 'https://api.github.com/repos/' + req.body.repository.full_name + '/issues/' + req.body.issue.number,
                                                method: 'PATCH',
                                                json: {
                                                    title: config.title, // The fallback is the origin title (before !spam)
                                                    body: config.body, // The fallback is the body if the issue before it was marked as spam
                                                    state: 'closed'
                                                },
                                                headers: {
                                                    'User-Agent': 'spammer/0.1.0',
                                                    Authorization: 'Bearer ' + JSON.parse(tokenResponse.body).token,
                                                    'Accept': 'application/json'
                                                }
                                            }
                                            // ^ Edit the issue so it is closed, and the content are nothing
                                            call(options, err => {
                                                if (err) {
                                                    return res.status(500).json(ERROR_MESSAGE)
                                                }
                                                var options = {
                                                    url: 'https://api.github.com/repos/' + req.body.repository.full_name + '/issues/' + req.body.issue.number + '/lock',
                                                    method: 'PUT',
                                                    json: {
                                                        lock_reason: 'spam'
                                                    },
                                                    headers: {
                                                        'User-Agent': 'spammer/0.1.0',
                                                        Accept: 'application/vnd.github.sailor-v-preview+json',
                                                        Authorization: 'Bearer ' + JSON.parse(tokenResponse.body).token
                                                    }
                                                }
                                                // ^ Lock's the issue as spam, this is experimental so it may not always work
                                                call(options, err => {
                                                    if (err) {
                                                        return res.status(500).json(ERROR_MESSAGE)
                                                    }
                                                    res.status(200).json(SUCCESS_MESSAGE)
                                                })
                                            })
                                        })
                                    })
                                }
                            })
                        }
                    })
                } else {
                    res.status(501).json(NOT_ADDED_MESSAGE)
                }
            } else {
                res.status(501).json(NOT_ADDED_MESSAGE)
            }
            break
        default:
            res.status(501).json(NOT_ADDED_MESSAGE)
    }
})
var listener = app.listen(process.env.PORT || 0, () => console.log('Spammer is listening at *:' + listener.address().port))
