Installations :- 
1. npm init -y
2. npm install electron
//For Linux Users, write command sudo npm install electron
3. npm install jquery
4. npm install ejs-electron

Steps:-
1. Create main.js

2. Update in package.json
(a).
{
    "main": "main.js",
}
(b).
"scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "electron ."
}

Execute by writing the following command in terminal
* npm start