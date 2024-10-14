export CSC_LINK="$(pwd)/build_assets/CertificatesDist.p12"
export CSC_KEY_PASSWORD="1courtney"
export APPLE_TEAM_ID="3Y4F3KTSJA"
export APPLE_ID=timwillie73@gmail.com
export APPLE_APP_SPECIFIC_PASSWORD="mjaz-xgdj-wqgj-bqiy"
export APPLE_API_KEY_ID=32R92U589C 

echo $CSC_LINK
echo $CSC_KEY_PASSWORD
rm -rf dist

npm run build:mac
