using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;

namespace Jackett.IntegrationTests
{
    [TestClass]
    public class ModernDashboardTests
    {
        [ClassInitialize]
        public static void StartBrowser(TestContext testContext)
        {
            _webDriver = WebDriverFactory.CreateFromEnvironmentVariableSettings();
            _webDriver.Manage().Timeouts().ImplicitWait = TimeSpan.FromSeconds(20);
            _webDriver.Manage().Timeouts().PageLoad = TimeSpan.FromSeconds(20);
        }

        [ClassCleanup]
        public static void StopBrowser() => _webDriver?.Quit();

        [TestMethod]
        public void DashboardLoadsSearchWorkspace()
        {
            _webDriver.Navigate().GoToUrl("http://localhost:9117/UI/Dashboard");

            var wait = new WebDriverWait(_webDriver, TimeSpan.FromSeconds(20));
            var search = wait.Until(driver => driver.FindElement(By.CssSelector("[data-testid='search-input']")));
            var results = _webDriver.FindElement(By.CssSelector("[data-testid='results-workspace']"));

            Assert.AreEqual("Jackett Search", _webDriver.Title);
            Assert.IsNotNull(search);
            Assert.IsNotNull(results);
        }

        private static IWebDriver _webDriver;
    }
}
