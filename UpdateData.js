//Load NodeJS modules
const fs = require('fs');

//Load 3rd party modules
const { EC2Client, DescribeInstancesCommand, DescribeInstanceAttributeCommand, Instance } = require('@aws-sdk/client-ec2');

//Load Scanner Configuration
const config = require('./scan.config.json');

//Create empty Array for instances
const InstanceList = [];

//AWS DescribeInstances Command, Filter can be done here if required)
const getManagedInstances = new DescribeInstancesCommand({
});

//Function to save Data
SaveData = () => {
  fs.writeFileSync('instancelist.json', JSON.stringify(InstanceList), 'utf8', (err) => {
    if(err) { process.stderr.write(err); }
    else { process.stdout.write('Instance list saved to instancelist.json'); }
  });
}

//Function to load Data from AWS API to JSON flat file
getInstances = async () => {
  //Read Config file and loop for each account in config
  for(let acc = 0; acc < config.Accounts.length; acc++) {
    //Loop for each reagion of the current account
    for(let region = 0; region < config.Accounts[acc].Regions.length; region++) {

      //Update user via CLI
      process.stdout.write(`Scanning: ${config.Accounts[acc].Name} -- ${config.Accounts[acc].Regions[region]}\n`);

      //Create new EC2 Client to pull the data
      const ec2 = new EC2Client({
        region: config.Accounts[acc].Regions[region],
        credentials: {
          accessKeyId: config.Accounts[acc].AWS_ID,
          secretAccessKey: config.Accounts[acc].AWS_Secret,
          sessionToken: config.Accounts[acc].AWS_Token
        }
      });

      //Get the data from the AWS API
      const instances = await ec2.send(getManagedInstances);
      
      //Loop through all the data using a for loop due to it being async
      //Loop through each reservation
      for(let i = 0; i < instances.Reservations.length; i++) {

        //Loop through each instance
        for(let j = 0; j < instances.Reservations[i].Instances.length; j++) {
          process.stdout.write('*');
          let instance = instances.Reservations[i].Instances[j];

          //Generate the command to pull the userdata from the describeattribute API
          const getUserData = new DescribeInstanceAttributeCommand({
            InstanceId: instance.InstanceId,
            Attribute: 'userData'
          });
    
          //Get the userdata from the AWS API
          const userdata = await ec2.send(getUserData);
    
          //Push data to the InstanceList array
          InstanceList.push({
            Name: instance.Tags[instance.Tags.findIndex(x => x.Key === 'Name')].Value || 'No Name Tag',
            Account: config.Accounts[acc].FriendlyName,
            AccountID: config.Accounts[acc].Account,
            InstanceId: instance.InstanceId,
            AMI: instance.ImageId,
            AZ: instance.Placement.AvailabilityZone,
            Platform: instance.Platform,
            SubNet: instance.SubnetId,
            VPC: instance.VpcId,
            IAMProfile: (instance.IamInstanceProfile ? instance.IamInstanceProfile.Arn : undefined),
            InstanceType: instance.InstanceType,
            State: instance.State.Name,
            Ip: instance.PrivateIpAddress,
            MacAddress: instance.NetworkInterfaces.MacAddress,
            LaunchTime: instance.LaunchTime,
            blockdevices: instance.BlockDeviceMappings,
            securityGroups: instance.SecurityGroups,
            Tags: instance.Tags,
            userData: {
              id: userdata.InstanceId,
              data: userdata.UserData.Value
            },
            LastScanTime: Date.now()
          });
        }
      }
      process.stdout.write('\n')
    }
  }
  //Store data locally in .json file
  SaveData();
  process.stdout.write(`\n Scan Completed`);
  process.stdout.write(`\n ${InstanceList.length} Instances found`);
  process.stdout.write(`\n Scan Results saved to instancelist.json`);
}

getInstances();