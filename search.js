//Node Modules
const fs = require('fs');

//3rd Party Packages
const { program } = require('commander');

// Internal Data
const instances = require('./instancelist.json');

// Configur program
program
  .name('Instance Search')
  .description('CLI script to search all instances and instance data')
  .version('0.0.4');

// Configure options
program
  .option('-s, --search <string>', 'Search', '')
  .option('-i, --instance <string>', 'Instance', undefined)
  .option('-n, --name <string>', 'Server Name', undefined)
  .option('-d, --detailed', 'Display Instance Information in Console')
  .option('-vol --volumes', 'Display Volume information')
  .option('-sg, --securitygroups', 'Display Security Group Info')
  .parse();

// Parse arguments and populate options
program.parse();
const options = program.opts();

//Generate Header
if (options.volumes) {
  process.stdout.write(`Account\t AccountID\t AZ\t Server\t InstanceID\t Device\t VolumeID\t AttachTime\n`)
} else if (options.securitygroups) {
  process.stdout.write(`Account\t AccountID\t AZ\t Server\t InstanceID\t VPC\t SG Name\t SG ID\n`)
} else if (options.detailed) {
  process.stdout.write(`Scanning ${instances.length} instances`);
} else {
  process.stdout.write(`Account\t AccountID\t AZ\t Server\t InstanceID\t IP\t Platform\t InstanceType\n`)
}

let results = [];

//Search Instance data
instances.forEach(instance => {
  if((!options.instance && !options.name) || (options.instance && instance.InstanceId.toLowerCase().includes(options.instance.toLowerCase())) || (options.name && instance.Name.toLowerCase().includes(options.name.toLowerCase()))) {
    if(JSON.stringify(instance).toLowerCase().includes(options.search.toLowerCase())) {
      if (options.volumes) {
        //Get all block devices
        const blockDevices = instance.blockdevices;
        blockDevices.forEach(disk => {
          process.stdout.write(`${instance.Account}\t ${instance.AccountID}\t ${instance.AZ}\t ${instance.Name}\t ${instance.InstanceId}\t ${disk.DeviceName}\t ${disk.Ebs.VolumeId}\t ${disk.Ebs.AttachTime} \n`)  
        })
        
      } else if (options.securitygroups) {
        //Get Security Groups
        const securityGroups = instance.securityGroups
        securityGroups.forEach(sg => {
          process.stdout.write(`${instance.Account}\t ${instance.AccountID}\t ${instance.AZ}\t ${instance.Name}\t ${instance.InstanceId}\t ${instance.VPC}\t ${sg.GroupName}\t ${sg.GroupId} \n`)
        })

      } else if (options.detailed) {
        process.stdout.write(JSON.stringify(instance,null,2))
      } else {
        process.stdout.write(`${instance.Account}\t ${instance.AccountID}\t ${instance.AZ}\t ${instance.Name}\t ${instance.InstanceId}\t ${instance.Ip}\t ${instance.Platform}\t ${instance.InstanceType}\n`);
      }     
    }
  }
});