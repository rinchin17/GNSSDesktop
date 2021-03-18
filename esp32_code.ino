#include "FS.h"
#include "SPIFFS.h"
#include "WiFi.h"
#include "ESPAsyncWebServer.h"
#include "MD5.h"
#include "SD.h"
#include <MD5Builder.h>

char* ssid = "Zuarifurnituresls5.1";
char* password = "bedrock@8540";

AsyncWebServer server(80);

#define FORMAT_SPIFFS_IF_FAILED true
#define chipSelect 5



MD5Builder _md5;

String md5(String str) {
    _md5.begin();
    _md5.add(String(str));
    _md5.calculate();
    return _md5.toString();
}

String listDir(fs::FS &fs, const char * dirname, uint8_t levels){
    String files = "";

    Serial.printf("Listing directory: %s\r\n", dirname);

    File root = fs.open(dirname);
    if(!root){
        Serial.println("- failed to open directory");
        return "failed to open directory";
    }
    if(!root.isDirectory()){
        //Serial.println(" - not a directory");
        return "not a directory";;
    }

    File file = root.openNextFile();
    while(file){
        if(file.isDirectory()){
            Serial.print("  DIR : ");
            Serial.println(file.name());
            if(levels){
                listDir(fs, file.name(), levels -1);
            }
        } else {
            Serial.print("  FILE: ");
            Serial.print(file.name());
            files = String(files + file.name() + " ");
        }
        file = root.openNextFile();
    }

  return files;
}

void writeFile(fs::FS &fs, const char * path, const char * message){
    Serial.printf("Writing file: %s\r\n", path);

    File file = fs.open(path, FILE_WRITE);
    if(!file){
        Serial.println("- failed to open file for writing");
        return;
    }
    if(file.print(message)){
        Serial.println("- file written");
    } else {
        Serial.println("- write failed");
    }
    file.close();
}

void deleteFile(fs::FS &fs, const char * path){
    Serial.printf("Deleting file: %s\r\n", path);
    if(fs.remove(path)){
        Serial.println("- file deleted");
    } else {
        Serial.println("- delete failed");
    }
}

void setup() {
    Serial.begin(9600);
  
    if(!SPIFFS.begin(FORMAT_SPIFFS_IF_FAILED)){
        Serial.println("SPIFFS Mount Failed");
        return;
    }

    if(!SD.begin(chipSelect)){
        Serial.println("Card Mount Failed!");
        return;
    }
    else{
        Serial.println("Card mounted successfully!");
    }
    uint8_t cardType = SD.cardType();
    
    if(cardType == CARD_NONE){
        Serial.println("No SD card attached");
        return;
    }
  
    listDir(SD, "/", 0);

    Serial.println();
    Serial.println();
    Serial.print("Connecting to ");
    Serial.println(ssid);

    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(".");
    }

    Serial.println("");
    Serial.println("WiFi connected");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(200, "text/plain", "ESP 32 web server");
    });

    server.on("/files", HTTP_GET, [](AsyncWebServerRequest *request){
        String files = listDir(SD, "/", 0); //list files in directory
        request->send(200, "text/plain", files);
    });

    server.on("/download", HTTP_GET, [](AsyncWebServerRequest *request){
        int fnsstart = request->url().lastIndexOf('/');
        String fn = request->url().substring(fnsstart);
        Serial.println("Download File: "+fn);
        // ... and finally
        request->send(SD, fn, String(), true);
    });

    server.on("/command", HTTP_GET, [](AsyncWebServerRequest *request){
        if(checksum(request->url())){
            request->send(200, "text/plain", "ACK");  
        }
        else{
            request->send(200, "text/plain", "NACK: Error in command transmission");  
        }
    });

    server.begin();
}

bool checksum(String commhash){
    int fnsstart = commhash.indexOf('$');
    int l= commhash.length() - 32;
    String hash = commhash.substring(l, commhash.length());
    String command = commhash.substring(fnsstart, l);

    if(hash == md5(command)){
        return true;
    }
    else{
        return false;
    }
}

void loop(){
    if (Serial.available()) {
        String comm=Serial.readString();
        Serial.println(comm);
        if(comm[0]=='$') {
            if(checksum(comm)) {
                Serial.println("ACK");  
            } else{
                Serial.println("NACK: Error in command transmission");
            }
        }
    }
}