//Load NodeJS modules
const fs = require('fs');

//Load 3rd party modules
const { EC2Client, DescribeInstancesCommand, DescribeInstanceAttributeCommand, DescribeVolumesCommand } = require('@aws-sdk/client-ec2');
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand } = require('@aws-sdk/client-elastic-load-balancing-v2');

//Load Scanner Configuration
const config = require('./scan.config.json');

//Create empty Array for instances
const ResourceList = [];

//Scanning Status
const scanStatus = [];
let isScanning = true;

//AWS DescribeInstances Command, Filter can be done here if required)
const getManagedInstances = new DescribeInstancesCommand({});

//AWS ListBuckets Command to get S3 Buckets, filter can be done here if required
const getS3Buckets = new ListBucketsCommand({});

//AWS Get all RDS Instances with single command, filtering can be done here if required
const getRDSInstances = new DescribeDBInstancesCommand({});

//AWS Get all ELB Instances with single command, filtering can be done here if required
const getLoadBalancers = new DescribeLoadBalancersCommand({});

//Function to save Data
SaveData = () => {
  fs.writeFileSync('awsdata.json', JSON.stringify(ResourceList), 'utf8', (err) => {
    if(err) { process.stderr.write(err); }
    else { process.stdout.write('Instance list saved to awsdata.json'); }
  });
}

// Async function to process multiple requests for userdata values
getUserData = async (requests) => {
  return Promise.all(requests).then((data) =>{
    data.forEach((instance) => {
      let instanceId = instance.InstanceId;
      let userdata = instance.UserData.Value;
      let instanceIndex = ResourceList.findIndex(x => x.InstanceId === instanceId);
      ResourceList[instanceIndex].userData = {
        id: instanceId,
        data: userdata
      }
    })
  })
}

getVolumeData = async (requests) => {
  return Promise.all(requests).then((data) => {
    data.forEach((instance) => {
      instance.Volumes.forEach((volume) => {
        let instanceId = volume.Attachments[0].InstanceId;
        let InstanceIndex = ResourceList.findIndex(x => x.InstanceId === instanceId);
        ResourceList[InstanceIndex].Volumes.push({
          DeviceName: volume.Attachments[0].Device,
          VolumeId: volume.VolumeId,
          AttachTime: volume.Attachments[0].AttachTime,
          State: volume.State,
          Size: volume.Size,
          VolumeType: volume.VolumeType,
          Iops: volume.Iops,
          Encrypted: volume.Encrypted,
          CreationTime: volume.CreateTime
        });
      });
    });
  });
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

    //S3 buckets are global, so we only need to scan once
    const s3 = new S3Client({
      credentials: {
        accessKeyId: config.Accounts[acc].AWS_ID,
        secretAccessKey: config.Accounts[acc].AWS_Secret,
        sessionToken: config.Accounts[acc].AWS_Token
      }
    });


    let S3Buckets = await s3.send(getS3Buckets);
    for(let i = 0; i < S3Buckets.Buckets.length; i++) {
      ResourceList.push({
        Resource: 'S3',
        Name: S3Buckets.Buckets[i].Name,
        Account: config.Accounts[acc].FriendlyName,
        AccountID: config.Accounts[acc].Account,
        CreationDate: S3Buckets.Buckets[i].CreationDate,
        LastScanTime: Date.now()
      });
    };


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

      //Create new RDS Client to pull the data
      const rds = new RDSClient({
        region: config.Accounts[acc].Regions[region],
        credentials: {
          accessKeyId: config.Accounts[acc].AWS_ID,
          secretAccessKey: config.Accounts[acc].AWS_Secret,
          sessionToken: config.Accounts[acc].AWS_Token
        }
      });

      const elb = new ElasticLoadBalancingV2Client({
        region: config.Accounts[acc].Regions[region],
        credentials: {
          accessKeyId: config.Accounts[acc].AWS_ID,
          secretAccessKey: config.Accounts[acc].AWS_Secret,
          sessionToken: config.Accounts[acc].AWS_Token
        }
      });

      //Get EC2 Instance List
      const instances = await ec2.send(getManagedInstances);
      let instanceRequests = [];
      let volumeRequests = [];
      
      //Loop through all the data using a for loop due to it being async
      //Loop through each reservation
      for(let i = 0; i < instances.Reservations.length; i++) {

        //Loop through each instance
        for(let j = 0; j < instances.Reservations[i].Instances.length; j++) {
          let instance = instances.Reservations[i].Instances[j];

          //Push data to the InstanceList array
          ResourceList.push({
            Resource: 'EC2',
            Name: instance.Tags ? instance.Tags[instance.Tags.findIndex(x => x.Key === 'Name')].Value : instance.InstanceId,
            Account: config.Accounts[acc].FriendlyName,
            AccountID: config.Accounts[acc].Account,
            InstanceId: instance.InstanceId,
            AMI: instance.ImageId,
            AZ: instance.Placement.AvailabilityZone,
            Platform: (instance.Platform === undefined) ? 'Linux' : 'Windows',
            SubNet: instance.SubnetId,
            VPC: instance.VpcId,
            IAMProfile: (instance.IamInstanceProfile ? instance.IamInstanceProfile.Arn : undefined),
            InstanceType: instance.InstanceType,
            State: instance.State.Name,
            Ip: instance.PrivateIpAddress,
            MacAddress: instance.NetworkInterfaces.MacAddress,
            LaunchTime: instance.LaunchTime,
            Volumes: [],
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
          //const userdata = await ec2.send(getUserData);
          instanceRequests.push(ec2.send(getUserDataCmd));
          if(instanceRequests.length >= 99) {
            await getUserData(instanceRequests);
            instanceRequests = [];
          }

          // Generate the command to pull the volume data from the describevolumes API
          const getVolumeDataCmd = new DescribeVolumesCommand({
            Filters: [ { Name: 'attachment.instance-id', Values: [instance.InstanceId] } ]
          });

          //Get the volume data from the AWS API
          volumeRequests.push(ec2.send(getVolumeDataCmd));
          if(volumeRequests.length >= 99) {
            await getVolumeData(volumeRequests);
            volumeRequests = [];
          }
        }
      }
      //Process all remaining requests
      if(instanceRequests.length > 0) {
        await getUserData(instanceRequests);
        instanceRequests = [];
      }
    
      if(volumeRequests.length > 0) {
        await getVolumeData(volumeRequests);
        volumeRequests = [];
      }

      //Scan for and get RDS Instances
      let RDSInstances = await rds.send(getRDSInstances);
      for(let i = 0; i < RDSInstances.DBInstances.length; i++) {
        ResourceList.push({
          Resource: 'RDS',
          Name: RDSInstances.DBInstances[i].DBInstanceIdentifier,
          Account: config.Accounts[acc].FriendlyName,
          AccountID: config.Accounts[acc].Account,
          Class: RDSInstances.DBInstances[i].DBInstanceClass,
          Engine: RDSInstances.DBInstances[i].Engine,
          EngineVersion: RDSInstances.DBInstances[i].EngineVersion,
          MultiAZ: RDSInstances.DBInstances[i].MultiAZ,
          PubliclyAccessible: RDSInstances.DBInstances[i].PubliclyAccessible,
          StorageType: RDSInstances.DBInstances[i].StorageType,
          StorageEncrypted: RDSInstances.DBInstances[i].StorageEncrypted,
          VPC: RDSInstances.DBInstances[i].DBSubnetGroup.VpcId,
          Subnet: RDSInstances.DBInstances[i].DBSubnetGroup.Subnets[0].SubnetIdentifier,
          SecurityGroups: RDSInstances.DBInstances[i].VpcSecurityGroups,
          Tags: RDSInstances.DBInstances[i].TagList,
          LastScanTime: Date.now()
        });
      }

      //Scan for and get all Load Balancers
      let lbList = await elb.send(getLoadBalancers);
      for(let i = 0; i < lbList.LoadBalancers.length; i++) {
        ResourceList.push({
          Resource: 'LB',
          Account: config.Accounts[acc].FriendlyName,
          AccountID: config.Accounts[acc].Account,
          Name: lbList.LoadBalancers[i].LoadBalancerName,
          DNSName: lbList.LoadBalancers[i].DNSName,
          Type: lbList.LoadBalancers[i].Type,
          AZList: lbList.LoadBalancers[i].AvailabilityZones,
          VPC: lbList.LoadBalancers[i].VpcId,
          SecurityGroups: lbList.LoadBalancers[i].SecurityGroups,
          IpType: lbList.LoadBalancers[i].IpAddressType,
          LastScanTime: Date.now()
        });
      };

      updateStatusInfo('Complete', config.Accounts[acc].Regions[region], config.Accounts[acc].FriendlyName);

    }
  }
  //Store data locally in .json file
  isScanning = false;
  SaveData();
}

generateStatusInfo();

const statusTimer = setInterval(() => {
  process.stdout.write(`\n AWSResource Scanner Scan Status: \n`);
  scanStatus.forEach((status) => {
    process.stdout.write(`\t${status.account}\t ${status.region}\t\t ${status.status}\n`);
  })

  if(isScanning) {
    process.stdout.moveCursor(0, -1 * (scanStatus.length + 2));
  } else { 
    process.stdout.write(`\n Scan Completed`);
    process.stdout.write(`\n ${ResourceList.length} Resources found`);
    process.stdout.write(`\n Scan Results saved to awsdata.json!`);
    statusTimer.unref();
  }
}, 500);


//Pull all regions within config for all accounts
getInstances();