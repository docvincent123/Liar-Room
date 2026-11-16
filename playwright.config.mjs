import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',
 timeout:45000,
 fullyParallel:false,
 workers:1,
 retries:0,
 use:{baseURL:'http://localhost:3000',browserName:'chromium',screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{command:'npm start',url:'http://localhost:3000/healthz',timeout:60000,reuseExistingServer:false},
 reporter:[['list'],['html',{open:'never'}]]
});
