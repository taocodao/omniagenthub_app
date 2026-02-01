// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@thirdweb-dev/contracts/extension/ContractMetadata.sol";

contract FileUpload  {
    mapping(string => string) private imageUpload;
    string[] private imageNames;

    mapping(string => string) private jasonUpload;
    string[] private jasonNames; // Keep track of JSON names for iteration

    string[] private tobeUploadJason; // Missing declaration corrected
    string[] private tobeUploadJason_copy;
    string[] private uploadedJason; // Missing declaration corrected

    // Function to add or overwrite an image
    function addImage(string memory imageName, string memory uri) public returns (bool) {
        bool isNewImage = bytes(imageUpload[imageName]).length == 0;
        imageUpload[imageName] = uri;
        
        if (isNewImage) {
            imageNames.push(imageName);
            return true; // New image added
        } else {
            return false; // Image was overwritten
        }
    }

    // Function to retrieve all images in the format "<imageName> : <uri>"
    function getAllImages() public view returns (string[] memory) {
        string[] memory allImages = new string[](imageNames.length);
        for (uint i = 0; i < imageNames.length; i++) {
            allImages[i] = string(abi.encodePacked(imageNames[i], " : ", imageUpload[imageNames[i]]));
        }
        return allImages;
    }

    // Function to add or overwrite a JSON
    function addJason(string memory jasonName, string memory uri) public returns (bool) {
        bool isNewJason = bytes(jasonUpload[jasonName]).length == 0;
        jasonUpload[jasonName] = uri;
        tobeUploadJason.push(jasonName); // Corrected usage
        if (isNewJason) {
            jasonNames.push(jasonName);
            return true; // New JSON added
        } else {
            return false; // JSON was overwritten
        }
    }

    // Function to retrieve all JSONs in the format "<jasonName> : <uri>"
    function getAllJasons() public view returns (string[] memory) {
        string[] memory allJasons = new string[](jasonNames.length);
        for (uint i = 0; i < jasonNames.length; i++) {
            allJasons[i] = string(abi.encodePacked(jasonNames[i], " : ", jasonUpload[jasonNames[i]]));
        }
        return allJasons;
    }

    // Correct implementation to "download" or process Jasons from tobeUploadJason to uploadedJason
    function downloadJason() public returns (string[] memory) {
        tobeUploadJason_copy = tobeUploadJason;
        for (uint i = 0; i < tobeUploadJason.length; i++) {
            uploadedJason.push(tobeUploadJason[i]);
        }
        delete tobeUploadJason; // Clear the array after processing
        return tobeUploadJason_copy; // This might not work as expected due to Solidity's constraints on returning state variables
    }
      
    function gettobeUploadJason() public view returns (string[] memory) {
          return tobeUploadJason;
    }

    function getUploadedJason() public view returns (string[] memory) {
          return uploadedJason;
    }

   
}


