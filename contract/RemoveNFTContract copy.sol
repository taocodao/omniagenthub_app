// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RemoveNFTContract {
    string[] private removedNFTIds;

    function removeNFT(string memory nftId) public {
        removedNFTIds.push(nftId);
    }

    function retrieveList() public view returns (string[] memory) {
        return removedNFTIds;
    }
}
