//Node Modules
const fs = require('fs');

//3rd Party Packages
const { program } = require('commander');

// Internal Data
const instances = require('./awsdata.json');

// Configur program
program
  .name('Userdata Scanner')
  .description('CLI scanner for userdata that lets you specificy strings to scan for')
  .version('0.0.1');

// Configure options
program
  .option('-s, --searchstring <string>', 'Search String','')
  .option('-i, --instance <string>', 'Instance to scan', '')
  .option('-n, --name <string>', 'Name of the instance', '')
  .option('-h, --human', 'Output in Human readable format')
  .option('-du, --displayuserdata', 'Display Userdata in Console')
  .option('-di, --displayinfo', 'Display Instance Information in Console')
  .parse();

// Parse arguments and populate options
program.parse();
const options = program.opts();

// Display total number of instances 
if(options.human) {
  process.stdout.write(`Scanning ${instances.length} instances`);
} else {
  process.stdout.write(`Account\t Environment\t AZ\t Server\t InstanceID\t Search\n`)
}

//Create empty Results array
let results = [];

instances.forEach(instance => {
  // Check if this instance should be included in results based on flags
  
  if((options.instance === '' && options.name === '') || (options.instance !== '' && instance.InstanceId.toLowerCase().includes(options.instance.toLowerCase())) || (options.name !== '' && instance.Name.toLowerCase().includes(options.name.toLowerCase()))) {
    //Check if Userdata exists
    if (instance.userData.data !== undefined) {
      //Convert Instance userdata from base64
      const userdata = Buffer.from(instance.userData.data, 'base64').toString().toLowerCase();

      //Search Userdata for search string
      if(userdata.toLowerCase().includes(options.searchstring.toLowerCase()) || options.searchstring === '') {
        
        //Get Instance Env tag if it exists
        const environment = instance.Tags.filter(tag => tag.Key === 'Env')[0].Value || 'Unknown';
        
        if(options.human) {
          process.stdout.write(`### Found ${options.searchstring} in userdata on ${instance.Name} (${instance.InstanceId}) -- ${instance.Account} (${instance.AccountID})\n`);
        } else {
          process.stdout.write(`${instance.Account}\t ${environment}\t ${instance.AZ}\t ${instance.Name}\t ${instance.InstanceId}\t ${options.searchstring}\n`);
        }
        
        //Display Userdata if flag is set
        if(options.displayuserdata) {
          process.stdout.write(`\n${instance.Name}`)
          process.stdout.write(`\n${userdata}`)
          process.stdout.write(`\n\n`)
        }

        if(options.displayinfo) {
          process.stdout.write(JSON.stringify(instance, null, 2));
        }
      }
    }
  }
});
