# Spammer [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
> The hosted version of this app is avalible at https://github.com/apps/spammer
## Setup
The first step is configuration, all you need to do is modify the `.env` file and add the private key from GitHub to `.data/spammer.pem`. This is a example of a `.env` file, keep not that you can skip the `.env` file and use regular enviroment varibles instead.
```bash
# GitHub Application Id
GITHUB_ISS=9768

# GitHub Application Webhook Secret
GITHUB_WEBHOOK=1234
```

# Usage
Alright, now go to a repository where the app is installed and create `.github/spammer.yml` with the following contents.
```
# This is the title for all future spam issues.
title: "Spam"

# This is the modified body if the issue for all future spam issues.
body: "This issue has been locked and marked as spam, be careful."
```
**Perfect**, now head over to `/issues` and create a issue, then change the title to `!spam` and refresh.