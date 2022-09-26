//Load NodeJS modules
const fs = require('fs');

//Load 3rd party modules
const { EC2Client, DescribeInstancesCommand, DescribeInstanceAttributeCommand } = require('@aws-sdk/client-ec2');

//Load Scanner Configuration
const config = require('./scan.config.json');

//Create empty Array for instances
const InstanceList = [];

//Scanning Status
const scanStatus = [];
let isScanning = true;

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

// Async function to process multiple requests for userdata values
getUserData = async (requests) => {
  return Promise.all(requests).then((data) =>{
    data.forEach((instance) => {
      let instanceId = instance.InstanceId;
      let userdata = instance.UserData.Value;
      let instanceIndex = InstanceList.findIndex(x => x.InstanceId === instanceId);
      InstanceList[instanceIndex].userData = {
        id: instanceId,
        data: userdata
      }
    })
  })
}

generateStatusInfo = () => {
  config.Accounts.forEach((account) => {
    account.Regions.forEach((region) => {
      scanStatus.push({
        account: account.FriendlyName,
        region: region,
        status: 'Pending'
      })
    })
  });
}

updateStatusInfo = (status, region, account) => {
  let statusIndex = scanStatus.findIndex(x => x.region === region && x.account === account);
  scanStatus[statusIndex].status = status;
}

//Function to load Data from AWS API to JSON flat file
getInstances = async () => {
  //Read Config file and loop for each account in config
  for(let acc = 0; acc < config.Accounts.length; acc++) {
    //Loop for each reagion of the current account
    for(let region = 0; region < config.Accounts[acc].Regions.length; region++) {

      //Update scan status
      updateStatusInfo('Scanning', config.Accounts[acc].Regions[region], config.Accounts[acc].FriendlyName);

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
      let instanceRequests = [];
      
      //Loop through all the data using a for loop due to it being async
      //Loop through each reservation
      for(let i = 0; i < instances.Reservations.length; i++) {

        //Loop through each instance
        for(let j = 0; j < instances.Reservations[i].Instances.length; j++) {
          let instance = instances.Reservations[i].Instances[j];

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
            metaData: instance.MetadataOptions,
            LastScanTime: Date.now()
          });

          // Generate the command to pull the userdata from the describeattribute API
          const getUserDataCmd = new DescribeInstanceAttributeCommand({
            InstanceId: instance.InstanceId,
            Attribute: 'userData'
          });
    
          //Get the userdata from the AWS API
          // const userdata = await ec2.send(getUserData);
          instanceRequests.push(ec2.send(getUserDataCmd));
          if(instanceRequests.length >= 99) {
            await getUserData(instanceRequests);
            instanceRequests = [];
          }
        }
      }
      //Process all remaining requests
      if(instanceRequests.length > 0) {
        await getUserData(instanceRequests);
        instanceRequests = [];
      }
      updateStatusInfo('Complete', config.Accounts[acc].Regions[region], config.Accounts[acc].FriendlyName);

    }
  }
  //Store data locally in .json file
  isScanning = false;
  SaveData();
}

generateStatusInfo();

const statusTimer = setInterval(() => {
  process.stdout.write(`\n EC2-Tools Scan Status: \n`);
  scanStatus.forEach((status) => {
    process.stdout.write(`\t${status.account}\t ${status.region}\t\t ${status.status}\n`);
  })

  if(isScanning) {
    process.stdout.moveCursor(0, -1 * (scanStatus.length + 2));
  } else { 
    process.stdout.write(`\n Scan Completed`);
    process.stdout.write(`\n ${InstanceList.length} Instances found`);
    process.stdout.write(`\n Scan Results saved to instancelist.json!`);
    statusTimer.unref();
  }
}, 500);


//Pull all regions within config for all accounts
getInstances();