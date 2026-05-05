#!/bin/bash
./mvnw clean compile > compile.log 2>&1
cat compile.log | grep -A 5 -B 5 "ERROR"
