This tool is used to manage Cascade CMS test instances. User needs access to a special type of Cascade instance to be able to use this tool. 
Hannon Hill does not currently provide access to such test instances. 

### Setting up the project for development

1. `cp default-custom-settings.yml custom-settings.yml`
2. `vi custom-settings.yml` and provide AWS API key for a user that has write access to S3 bucket and the name of the bucket to which this tool should be uploaded
3. `cd client && npm install && cd .. && npm install`

Then:

- Run `gulp dev` for local development
- Run `gulp deploy` to deploy the tool to S3, optionally set up CloudFront distribution and a Route 53 Record Set for the tool

When developing locally, clone `Cascade` and `Cascade-Installer` projects so that they are siblings of `Cascade-Test-Instance-Manager` and set up these projects so that Cascade CMS can be deployed and can run on port `8080` by connecting to a database with name `cascade`


### Running monitor on the test instance

- For the first time: 
  1. Clone `Cascade` and `Cascade-Installer` projects so that they are siblings of `Cascade-Test-Instance-Manager` and set up these projects so that Cascade CMS can be deployed and can run on port `8080` by connecting to a database with name `cascade`
  2. Open ports `3001` and `3002`
  3. `npm install -g gulp && git clone https://github.com/hannonhill/Cascade-Test-Instance-Manager.git && cd Cascade-Test-Instance-Manager && npm install && cp default-custom-settings.yml custom-settings.yml && nohup gulp start-instance-monitor &`
- Install an update:
  1. Stop currently running instance `ps aux | grep gulp`, find process id and then `kill -9 {pid}` 
  2. While in `Cascade-Test-Instance-Manager`: `git pull && npm install && nohup gulp start-instance-monitor &`
