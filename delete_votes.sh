#!/bin/bash
set -x

aws_profile=rix-admin-chris

export AWS_PROFILE=$aws_profile

aws s3 rm s3://city-vote-data/votes/votes.json 