const HDA = artifacts.require("PatientDataAccess");

module.exports = function (deployer) {
  deployer.deploy(HDA);
};