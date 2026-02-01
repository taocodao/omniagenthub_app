// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ChatCounterAndRatingContract {
    string public constant CONTRACT_DESCRIPTION = "This contract is used to count chat interactions and rate them.";
    string public constant VERSION = "1.0";

    // Mapping from tokenId to a mapping of user (address as string) to their rating
    mapping(string => mapping(string => uint256)) private userRatings; 
    // Total sum of ratings for each tokenId, for averaging
    mapping(string => uint256) private totalRatings; 
    // Count of ratings for each tokenId, for averaging
    mapping(string => uint256) private ratingCounts;
    // Mapping for chat counts
    mapping(string => uint256) private chatCounts;
    // Arrays to store tokenIds for chats and ratings
    string[] private chatTokenIds;
    string[] private ratingTokenIds;

    // Assume this address is the one allowed to update chat counts, for example
    address private admin;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Caller is not the admin");
        _;
    }

    // Function to rate an application. Overwrites the old rating if one exists.
    function rateApplication(string memory tokenId, string memory userAddress, uint256 rating) public {
        require(rating >= 1 && rating <= 5, "Rating must be between 1 and 5.");

        uint256 currentRating = userRatings[tokenId][userAddress];
        if (currentRating != 0) {
            // User is updating their rating
            totalRatings[tokenId] = totalRatings[tokenId] - currentRating + rating;
        } else {
            // First time rating, increment count
            ratingCounts[tokenId]++;
            totalRatings[tokenId] += rating;
            // Check if tokenId is not already in ratingTokenIds and add it
            if(!_existsInArray(tokenId, ratingTokenIds)) {
                ratingTokenIds.push(tokenId);
            }    
        }

        userRatings[tokenId][userAddress] = rating;
    }

   function getAverageRating(string memory tokenId) public view returns (uint256) {
    if (ratingCounts[tokenId] == 0) return 0; // Prevent division by zero
    // Scale the result by 10 to keep one decimal place of precision
    return (totalRatings[tokenId] * 10) / ratingCounts[tokenId];
}

    // Retrieves a user's rating for a specific application.
    function getUserRating(string memory tokenId, string memory userAddress) public view returns (uint256) {
        return userRatings[tokenId][userAddress];
    }

    // Function to update chat counts, 
    function updateChatCount(string memory tokenId, uint256 count) public {
        chatCounts[tokenId] += count;
        // Check if tokenId is not already in chatTokenIds and add it
        if(!_existsInArray(tokenId, chatTokenIds)) {
            chatTokenIds.push(tokenId);
        }
    }

    // Function to retrieve chat counts for a specific tokenId
    function getChatCount(string memory tokenId) public view returns (uint256) {
        return chatCounts[tokenId];
    }

     // Helper function to check if a string exists in an array
    function _existsInArray(string memory value, string[] storage array) private view returns (bool) {
        for (uint i = 0; i < array.length; i++) {
            if (keccak256(abi.encodePacked(array[i])) == keccak256(abi.encodePacked(value))) {
                return true;
            }
        }
        return false;
    }

    // Corrected function for retrieving all average ratings
    function getAllAverageRatings() public view returns (string[] memory) {
        string[] memory allRatings = new string[](ratingTokenIds.length);
        for (uint i = 0; i < ratingTokenIds.length; i++) {
            uint256 averageRating = getAverageRating(ratingTokenIds[i]);
            allRatings[i] = string(abi.encodePacked(ratingTokenIds[i], " : ", uintToStringWithDecimal(averageRating)));
        }
        return allRatings;
    }

    // Corrected function for retrieving all chat counts
    function getAllChatCounts() public view returns (string[] memory) {
        string[] memory allCounts = new string[](chatTokenIds.length);
        for (uint i = 0; i < chatTokenIds.length; i++) {
            uint256 count = getChatCount(chatTokenIds[i]);
            allCounts[i] = string(abi.encodePacked(chatTokenIds[i], " : ", uintToString(count)));
        }
        return allCounts;
    }

 function uintToString(uint _i) public pure returns (string memory) {
    if (_i == 0) {
        return "0";
    }
    uint j = _i;
    uint len = 0;
    while (j != 0) {
        len++;
        j /= 10;
    }
    bytes memory bstr = new bytes(len);
    uint k = len;
    while (_i != 0) {
        k = k - 1;
        bstr[k] = bytes1(uint8(48 + _i % 10));
        _i /= 10;
    }
    return string(bstr);
}   

function uintToStringWithDecimal(uint256 _i) public pure returns (string memory) {
    if (_i == 0) {
        return "0";
    }

    // Determine if there is a need to add a decimal point
    bool hasDecimal = _i % 10 > 0;
    uint256 integerPart = _i / 10;
    uint256 decimalPart = _i % 10;

    // Convert integer part to string
    string memory integerPartStr = uintToString(integerPart);

    // Handling the decimal part directly, as it's always a single digit in this context
    string memory decimalStr = hasDecimal ? uintToString(decimalPart) : "0";

    // Concatenate decimal part
    return string(abi.encodePacked(integerPartStr, ".", decimalStr));
}


}

