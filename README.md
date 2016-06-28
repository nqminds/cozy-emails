# [Cozy](http://cozy.io) Emails

Modern Email Client Based on Node.js and React.js with a new package [FileDOWN](git clone git@bitbucket.org:Mereacre/filedown.git).

## Install
Clone the git repository:

```
git@github.com:nqminds/cozy-emails.git
```



## Run
Run Emails with the command line, it will listen on the 9125 port:

    ./bin/emails

## Development
Cozy emails relies on LevelDB to store the database, which acts as an adapter to PouchDB. In this git version the LevelDB adapter was changed to FileDOWN (package developed on top of MemDOWN):

```
git clone git@github.com:nqminds/FileDOWN.git
```

### The FileDOWN dependence was added to: ###

*cozy-emails / node_modules / cozy-db-pouchdb / lib / index.js:84*

*return PouchModel.db = new Pouch(options.dbName, {db: require('filedown') });*


### Cozy stores the database in: ###

[OpenWRT] ~/.emails

[Linux/Ubuntu] ~/user/.emails

The attachments are located in ./emails/attachments

The database is located in the directories ./emails/db, ./emails/db-mrview-*
