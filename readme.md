# EC2 Quick Search Tool
## NOTE
Search is currently Broken due to the additions of multiple resource types and changes to the main JSON data structure
## What
Account to pull EC2 info for multiple accounts, multiple regions based on configurations and cache the results in a local json file for processing or querying from other scripts
## Tools
### UpdateData.js
This uses the config file to pull data from the accounts and regions specified, it has no command line options.
all instance data is stored in a single json file called awsdata.json

node updatedata.js

## Notes
By default the scripts output everything in a TSV format so you can export the output directly into a file and import into your favorite spreadsheet application. Please refer to the CLI options for other options via the console.

## Setup
Will require NodeJS for this tool, I receommend installing it via NVM [https://github.com/nvm-sh/nvm]

Once node is installed the following command to install the required AWS SDK libraries and 3rd party libraries.
```npm i```

## Configuration
All configuration is stored in a json file named "scan.config.json" that you will need to create.
Example Config File, Currently this uses the ID, Secret, and Token from the AWS SSO Login
```
{
  "Accounts": [
    {
      "Name": "Production - 1234-1234-1234",
      "FriendlyName": "Production",
      "Account": "1234-1234-1234",
      "AWS_ID":"" ,
      "AWS_Secret": "",
      "AWS_Token": "",
      "Regions": ["us-east-1", "us-east-2", "ca-central-1"]
    },
    {
      "Name": "Development - 1234-1234-1234",
      "FriendlyName": "Account 2",
      "Account": "",
      "AWS_ID":"" ,
      "AWS_Secret": "",
      "AWS_Token": "",
      "Regions": ["us-east-1", "us-east-2", "eu-central-1", "ca-central-1"]
    }
  ]
}
```

### Search.js
```
CLI script to search all instances and instance data

Options:
  -V, --version            output the version number
  -s, --search <string>    Search (default: "")
  -i, --instance <string>  Instance
  -n, --name <string>      Server Name
  -d, --detailed           Display Instance Information in Console
  -vol --volumes           Display Volume information
  -sg, --securitygroups    Display Security Group Info
  -h, --help               display help for command
  ```

### scanuserdata.js
```
CLI scanner for userdata that lets you specificy strings to scan for

Options:
  -V, --version                 output the version number
  -s, --searchstring <string>   String to scan for
  -i, --instance <instance id>  Instance to scan
  -n, --name <string>           Name of the instance
  -h, --human                   Output in Human readable format
  -du, --displayuserdata        Display Userdata in Console
  -di, --displayinfo            Display Instance Information in Console
  --help                        display help for command
  ```