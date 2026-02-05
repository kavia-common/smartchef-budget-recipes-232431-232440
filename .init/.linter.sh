#!/bin/bash
cd /home/kavia/workspace/code-generation/smartchef-budget-recipes-232431-232440/smartchef_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

