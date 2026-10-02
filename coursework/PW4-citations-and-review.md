# Practical Work 4 — Conducting and Designing a Literature Review on the Research Topic

**Project topic:** Real-time point-of-sale (POS) analytics for a small coffee-shop chain — dashboards, forecasting, anomaly detection, and an LLM-based conversational assistant (*aura-track*).

**A note on plagiarism:** all formulations below are written in this document; sources are paraphrased or quoted with attribution. Direct quotations would require page numbers (IEEE: `[n, p. x]`), paraphrases require in-text attribution, and every in-text citation has a matching full reference.

---

## Task 1. Common Citation Styles

### Source inventory (42 sources)

| ID | Type | Source |
|---|---|---|
| S1 | Article | Hartzel & Wood (2017), *EJOR* — POS reporting & forecast accuracy |
| S2 | Article | Abolghasemi, Rostami-Tabar & Syntetos (2022), *IJPR* — POS info value |
| S3 | Article | Fildes, Ma & Kolassa (2022), *IJF* — retail forecasting review |
| S4 | Article | Tanizaki et al. (2019), *Procedia CIRP* — restaurant demand forecasting |
| S5 | Article | Schmidt, Kabir & Hoque (2022), *MAKE* — restaurant sales forecasting |
| S6 | Article | Nguyen et al. (2021), *IJIM* — LSTM forecasting + anomaly detection |
| S7 | Article | Hong et al. (2025), *IEEE TKDE* — LLM text-to-SQL survey |
| S8 | Book | Few (2013), *Information Dashboard Design* |
| S9 | Book | Shmueli, Bruce & Patel (2020), *Data Mining for Business Analytics* |
| S10 | Book | Kimball & Ross (2013), *The Data Warehouse Toolkit* |
| S11 | Book | Provost & Fawcett (2013), *Data Science for Business* |
| S12 | Book | Hyndman & Athanasopoulos (2021), *Forecasting: Principles and Practice* |
| S13 | Journal | Yigitbasioglu & Velcu (2012), *IJAIS* — dashboard review |
| S14 | Journal | Nadj, Maedche & Schieder (2020), *DSS* — dashboards & situation awareness |
| S15 | Journal | Hjelle et al. (2024), *Information & Management* — dashboards & decision quality |
| S16 | Journal | Makridakis, Spiliotis & Assimakopoulos (2022), *IJF* — M5 competition |
| S17 | Journal | Llave (2017), *Procedia CS* — BI&A in SMEs |
| S18 | Newspaper | Reuters (2025) — Starbucks rolls out AI for inventory counting |
| S19 | Newspaper | Reuters (2022) — U.S. coffee chains' sales rise 10 % |
| S20 | Newspaper | Rogers (2024), CNBC — McDonald's ends AI drive-thru test |
| S21 | Newspaper | Cerullo (2024), CBS News — McDonald's ends AI drive-thru orders |
| S22 | Newspaper | Haven (2014), Sprudge — Square's café POS data |
| S23 | Dissertation | Abrishami (2019), FSU — time series for BI applications |
| S24 | Dissertation | Schmidt (2021), Univ. of New Orleans — ML restaurant sales forecasting |
| S25 | Dissertation | Chukwuma (2023), Univ. of Huddersfield — big data analytics in retail |
| S26 | Dissertation | Peng (2022), SMU — retail analytics |
| S27 | Dissertation | Vähä-Erkkilä (2024), Univ. of Vaasa — BI for sales forecasting |
| S28 | Electronic | Lian et al. (2024), ChatBI — arXiv preprint |
| S29 | Electronic | National Coffee Association (2024), NCDT report |
| S30 | Electronic | Kaggle (2020), M5 forecasting dataset |
| S31 | Electronic | OECD (2025), AI adoption by SMEs |
| S32 | Electronic | Tableau (2026), "What is a KPI dashboard?" |
| S33 | Patent | Jain et al., US 11 036 715 B2 — anomaly detection in time series |
| S34 | Patent | Richter, US 2014/0067470 A1 — sales automation analytics |
| S35 | Patent | Karthik et al., US 11 416 881 B2 — sales forecasting (N-Gram) |
| S36 | Patent | Corbo et al., US 8 812 386 B2 — retail planning & forecasting |
| S37 | Patent | Kahlow, US 2016/0048854 A1 — sales prediction systems |
| S38 | Additional | ISO 9241-210:2019 — human-centred design standard |
| S39 | Additional | ISO 9241-11:2018 — usability definitions and concepts |
| S40 | Additional | Toledano et al. (2017), PMLR — real-time anomaly detection at scale |
| S41 | Additional | Gantz & Reinsel (2012), IDC — The Digital Universe in 2020 (technical report) |
| S42 | Additional | Fildes, Ma & Kolassa (2018), MPRA/Working paper — retail forecasting |

---

### 1. APA style (7th edition)

*Author, A. A., & Author, B. B. (Year). Title of the article. Name of the Periodical, volume(issue), pages. https://doi.org/xxxx*

**Articles (S1–S7)**

1. Hartzel, K. S., & Wood, C. A. (2017). Factors that affect the improvement of demand forecast accuracy through point-of-sale reporting. *European Journal of Operational Research*, *260*(1), 171–182. https://doi.org/10.1016/j.ejor.2016.11.047
2. Abolghasemi, M., Rostami-Tabar, B., & Syntetos, A. (2022). The value of point of sales information in upstream supply chain forecasting: An empirical investigation. *International Journal of Production Research*, *61*(7), 2162–2177. https://doi.org/10.1080/00207543.2022.2063086
3. Fildes, R., Ma, S., & Kolassa, S. (2022). Retail forecasting: Research and practice. *International Journal of Forecasting*, *38*(4), 1283–1318. https://doi.org/10.1016/j.ijforecast.2019.06.004
4. Tanizaki, T., Hoshino, T., Shimmura, T., & Takenaka, T. (2019). Demand forecasting in restaurants using machine learning and statistical analysis. *Procedia CIRP*, *79*, 679–683. https://doi.org/10.1016/j.procir.2019.02.042
5. Schmidt, A. B., Kabir, M. R., & Hoque, M. (2022). Machine learning based restaurant sales forecasting. *Machine Learning and Knowledge Extraction*, *4*(1), 105–130. https://doi.org/10.3390/make4010006
6. Nguyen, H. D., Tran, K. P., Thomassey, S., & Hamad, M. (2021). Forecasting and anomaly detection approaches using LSTM and LSTM autoencoder techniques with the applications in supply chain management. *International Journal of Information Management*, *57*, 102282. https://doi.org/10.1016/j.ijinfomgt.2020.102282
7. Hong, Z., Yuan, Z., Zhang, Q., Chen, H., Dong, J., Huang, F., & Huang, X. (2025). Next-generation database interfaces: A survey of LLM-based text-to-SQL. *IEEE Transactions on Knowledge and Data Engineering*, *37*(12), 7328–7345. https://doi.org/10.1109/TKDE.2025.3609486

**Books (S8–S12)**

8. Few, S. (2013). *Information dashboard design: Displaying data for at-a-glance monitoring* (2nd ed.). Analytics Press.
9. Shmueli, G., Bruce, P. C., & Patel, N. R. (2020). *Data mining for business analytics: Concepts, techniques, and applications in Python* (1st ed.). Wiley.
10. Kimball, R., & Ross, M. (2013). *The data warehouse toolkit: The definitive guide to dimensional modeling* (3rd ed.). Wiley.
11. Provost, F., & Fawcett, T. (2013). *Data science for business: What you need to know about data mining and data-analytic thinking*. O'Reilly Media.
12. Hyndman, R. J., & Athanasopoulos, G. (2021). *Forecasting: Principles and practice* (3rd ed.). OTexts. https://otexts.com/fpp3/

**Journals (S13–S17)**

13. Yigitbasioglu, O. M., & Velcu, O. (2012). A review of dashboards in performance management: Implications for design and research. *International Journal of Accounting Information Systems*, *13*(1), 41–59. https://doi.org/10.1016/j.accinf.2011.08.002
14. Nadj, M., Maedche, A., & Schieder, C. (2020). The effect of interactive analytical dashboard features on situation awareness and task performance. *Decision Support Systems*, *135*, 113322. https://doi.org/10.1016/j.dss.2020.113322
15. Hjelle, S., Mikalef, P., Altwaijry, N., & Parida, V. (2024). Organizational decision making and analytics: An experimental study on dashboard visualizations. *Information & Management*, *61*(6), 104011. https://doi.org/10.1016/j.im.2024.104011
16. Makridakis, S., Spiliotis, E., & Assimakopoulos, V. (2022). The M5 accuracy competition: Results, findings, and conclusions. *International Journal of Forecasting*, *38*(4), 1346–1364. https://doi.org/10.1016/j.ijforecast.2021.11.013
17. Llave, M. R. (2017). Business intelligence and analytics in small and medium-sized enterprises: A systematic literature review. *Procedia Computer Science*, *121*, 194–205. https://doi.org/10.1016/j.procs.2017.11.027

**Newspapers (S18–S22)**

18. Reuters. (2025, September 3). Starbucks rolls out AI for inventory counting. https://www.reuters.com/business/starbucks-rolls-out-ai-inventory-counting-2025-09-03
19. Reuters. (2022, September 13). U.S. coffee chains' sales rise 10% to near pre-pandemic levels, report says. https://www.reuters.com/business/retail-consumer/us-coffee-chains-sales-rise-10-near-pre-pandemic-levels-report-2022-09-13
20. Rogers, K. (2024, June 17). McDonald's to end AI drive-thru test with IBM. CNBC. https://www.cnbc.com/2024/06/17/mcdonalds-to-end-ibm-ai-drive-thru-test.html
21. Cerullo, M. (2024, June 17). McDonald's ends AI drive-thru orders — for now. CBS News. https://www.cbsnews.com/news/mcdonalds-ends-ai-drive-thru-ordering/
22. Haven, L. (2014, September 4). Square is collecting coffee shop data and you won't believe what they found. Sprudge. https://sprudge.com/square-collecting-coffee-shop-data-62118.html

**Dissertations (S23–S27)**

23. Abrishami, S. (2019). *Time series analysis and forecasting for business intelligence applications* [Doctoral dissertation, Florida State University]. FSU Digital Repository. http://purl.flvc.org/fsu/fd/2019_Summer_Abrishami_fsu_0071E_15325
24. Schmidt, A. B. (2021). *Machine learning based restaurant sales forecasting* [Master's thesis, University of New Orleans]. ScholarWorks@UNO. https://scholarworks.uno.edu/td/2876
25. Chukwuma, O. I. (2023). *Investigating the challenges in the implementation of big data analytics solutions to influence the retail business models* [Doctoral dissertation, University of Huddersfield]. https://pure.hud.ac.uk/ws/portalfiles/portal/94976307/Final_Thesis_O_Chukwuma.pdf
26. Peng, Y. (2022). *Consumer search and marketing actions in retailing* [Doctoral dissertation, Singapore Management University]. Institutional Knowledge at SMU. https://ink.library.smu.edu.sg/etd_coll/394
27. Vähä-Erkkilä, L. (2024). *Developing sales forecasting by utilizing business intelligence: A single case study* [Master's thesis, University of Vaasa]. Osuva. https://urn.fi/URN:NBN:fi-fe2024032012138

**Electronic resources (S28–S32)**

28. Lian, J., Liu, X., Shao, Y., Dong, Y., Wang, M., Wei, Z., Wan, T., Dong, M., & Yan, H. (2024). *ChatBI: Towards natural language to complex business intelligence SQL*. arXiv. https://doi.org/10.48550/arXiv.2405.00527
29. National Coffee Association of U.S.A. (2024). *2024 National Coffee Data Trends: Specialty coffee report*. Specialty Coffee Association. https://sca.coffee/sca-news/2024-national-coffee-data-trends-specialty-coffee-breakout-report-now-available
30. Kaggle. (2020). *M5 forecasting – Accuracy* [Dataset]. https://www.kaggle.com/c/m5-forecasting-accuracy
31. Organisation for Economic Co-operation and Development. (2025). *AI adoption by small and medium-sized enterprises* (Discussion paper prepared for the G7 Report). OECD Publishing. https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/12/ai-adoption-by-small-and-medium-sized-enterprises_9c48eae6/426399c1-en.pdf
32. Tableau. (2026). *What is a KPI dashboard?* https://www.tableau.com/kpi/what-is-kpi-dashboard

**Patents (S33–S37)**

33. Jain, V., Klementiev, D. A., Sakhnov, I., Papak, D., Thangavel, L., Zervos, M., Gakkhar, D., & Boikovska, K. (2021). *Combination of techniques to detect anomalies in multi-dimensional time series* (U.S. Patent No. 11 036 715 B2). U.S. Patent and Trademark Office.
34. Richter, J. N. (2014). *Predictive and profile learning sales automation analytics system and method* (U.S. Patent Application No. 2014/0067470 A1). U.S. Patent and Trademark Office.
35. Karthik, G., Achar, A., & Ravindran, B. (2022). *Method and system for forecasting sales based on N-Gram model* (U.S. Patent No. 11 416 881 B2). U.S. Patent and Trademark Office.
36. Corbo, J., Baker, M., & Roggenburk, K. (2014). *Retail planning application and method for consumer products* (U.S. Patent No. 8 812 386 B2). U.S. Patent and Trademark Office.
37. Kahlow, A. (2016). *Sales prediction systems and methods* (U.S. Patent Application No. 2016/0048854 A1). U.S. Patent and Trademark Office.

**Additional documents (S38–S42)**

38. International Organization for Standardization. (2019). *Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems* (ISO Standard No. 9241-210). https://www.iso.org/standard/77464.html
39. International Organization for Standardization. (2018). *Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts* (ISO Standard No. 9241-11). https://www.iso.org/standard/63500.html
40. Toledano, M., Cohen, I., Ben-Simhon, Y., & Tadeski, I. (2017). Real-time anomaly detection system for time series at scale. In *Proceedings of Machine Learning Research: Vol. 71. KDD 2017 Workshop on Anomaly Detection in Finance* (pp. 56–65). PMLR.
41. Gantz, J., & Reinsel, D. (2012). *The digital universe in 2020: Big data, bigger digital shadows, and biggest growth in the far east*. IDC.
42. Fildes, R., Ma, S., & Kolassa, S. (2018). *Retail forecasting: Research and practice* (Management Science Working Paper 2018:04; MPRA Paper No. 89356). https://mpra.ub.uni-muenchen.de/89356/

---

### 2. Chicago style (Notes–Bibliography, bibliography entries)

*Author. "Title of article." Journal volume, no. issue (year): pages. https://doi.org/xxxx*

**Articles**

1. Hartzel, Kathleen S., and Charles A. Wood. "Factors That Affect the Improvement of Demand Forecast Accuracy through Point-of-Sale Reporting." *European Journal of Operational Research* 260, no. 1 (2017): 171–82. https://doi.org/10.1016/j.ejor.2016.11.047.
2. Abolghasemi, Mahdi, Bahman Rostami-Tabar, and Aris Syntetos. "The Value of Point of Sales Information in Upstream Supply Chain Forecasting: An Empirical Investigation." *International Journal of Production Research* 61, no. 7 (2022): 2162–77. https://doi.org/10.1080/00207543.2022.2063086.
3. Fildes, Robert, Shaohui Ma, and Stephan Kolassa. "Retail Forecasting: Research and Practice." *International Journal of Forecasting* 38, no. 4 (2022): 1283–1318. https://doi.org/10.1016/j.ijforecast.2019.06.004.
4. Tanizaki, Takashi, Tomohiro Hoshino, Takeshi Shimmura, and Takeshi Takenaka. "Demand Forecasting in Restaurants Using Machine Learning and Statistical Analysis." *Procedia CIRP* 79 (2019): 679–83. https://doi.org/10.1016/j.procir.2019.02.042.
5. Schmidt, Austin B., Md. R. Kabir, and Md. Hoque. "Machine Learning Based Restaurant Sales Forecasting." *Machine Learning and Knowledge Extraction* 4, no. 1 (2022): 105–30. https://doi.org/10.3390/make4010006.
6. Nguyen, Huu Duy, Kim Phuc Tran, Sebastien Thomassey, and Marwa Hamad. "Forecasting and Anomaly Detection Approaches Using LSTM and LSTM Autoencoder Techniques with the Applications in Supply Chain Management." *International Journal of Information Management* 57 (2021): 102282. https://doi.org/10.1016/j.ijinfomgt.2020.102282.
7. Hong, Zijin, Zheng Yuan, Qinggang Zhang, Hao Chen, Junnan Dong, Feiran Huang, and Xiao Huang. "Next-Generation Database Interfaces: A Survey of LLM-Based Text-to-SQL." *IEEE Transactions on Knowledge and Data Engineering* 37, no. 12 (2025): 7328–45. https://doi.org/10.1109/TKDE.2025.3609486.

**Books**

8. Few, Stephen. *Information Dashboard Design: Displaying Data for At-a-Glance Monitoring*. 2nd ed. Vancouver, WA: Analytics Press, 2013.
9. Shmueli, Galit, Peter C. Bruce, and Nitin R. Patel. *Data Mining for Business Analytics: Concepts, Techniques, and Applications in Python*. 1st ed. Hoboken, NJ: Wiley, 2020.
10. Kimball, Ralph, and Margy Ross. *The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling*. 3rd ed. Hoboken, NJ: Wiley, 2013.
11. Provost, Foster, and Tom Fawcett. *Data Science for Business: What You Need to Know about Data Mining and Data-Analytic Thinking*. Sebastopol, CA: O'Reilly Media, 2013.
12. Hyndman, Rob J., and George Athanasopoulos. *Forecasting: Principles and Practice*. 3rd ed. Melbourne, Australia: OTexts, 2021. https://otexts.com/fpp3/.

**Journals**

13. Yigitbasioglu, Ogan M., and Oana Velcu. "A Review of Dashboards in Performance Management: Implications for Design and Research." *International Journal of Accounting Information Systems* 13, no. 1 (2012): 41–59. https://doi.org/10.1016/j.accinf.2011.08.002.
14. Nadj, Mario, Alexander Maedche, and Christian Schieder. "The Effect of Interactive Analytical Dashboard Features on Situation Awareness and Task Performance." *Decision Support Systems* 135 (2020): 113322. https://doi.org/10.1016/j.dss.2020.113322.
15. Hjelle, Sara, Patrick Mikalef, Najwa Altwaijry, and Vinit Parida. "Organizational Decision Making and Analytics: An Experimental Study on Dashboard Visualizations." *Information & Management* 61, no. 6 (2024): 104011. https://doi.org/10.1016/j.im.2024.104011.
16. Makridakis, Spyros, Eva Spiliotis, and Vassilios Assimakopoulos. "The M5 Accuracy Competition: Results, Findings, and Conclusions." *International Journal of Forecasting* 38, no. 4 (2022): 1346–64. https://doi.org/10.1016/j.ijforecast.2021.11.013.
17. Llave, Marilex Rea. "Business Intelligence and Analytics in Small and Medium-Sized Enterprises: A Systematic Literature Review." *Procedia Computer Science* 121 (2017): 194–205. https://doi.org/10.1016/j.procs.2017.11.027.

**Newspapers**

18. Reuters. "Starbucks Rolls Out AI for Inventory Counting." September 3, 2025. https://www.reuters.com/business/starbucks-rolls-out-ai-inventory-counting-2025-09-03.
19. Reuters. "U.S. Coffee Chains' Sales Rise 10% to Near Pre-Pandemic Levels, Report Says." September 13, 2022. https://www.reuters.com/business/retail-consumer/us-coffee-chains-sales-rise-10-near-pre-pandemic-levels-report-2022-09-13.
20. Rogers, Kate. "McDonald's to End AI Drive-Thru Test with IBM." CNBC, June 17, 2024. https://www.cnbc.com/2024/06/17/mcdonalds-to-end-ibm-ai-drive-thru-test.html.
21. Cerullo, Megan. "McDonald's Ends AI Drive-Thru Orders — for Now." CBS News, June 17, 2024. https://www.cbsnews.com/news/mcdonalds-ends-ai-drive-thru-ordering/.
22. Haven, Leif. "Square Is Collecting Coffee Shop Data and You Won't Believe What They Found." Sprudge, September 4, 2014. https://sprudge.com/square-collecting-coffee-shop-data-62118.html.

**Dissertations**

23. Abrishami, Soheila. "Time Series Analysis and Forecasting for Business Intelligence Applications." PhD diss., Florida State University, 2019. http://purl.flvc.org/fsu/fd/2019_Summer_Abrishami_fsu_0071E_15325.
24. Schmidt, Austin B. "Machine Learning Based Restaurant Sales Forecasting." Master's thesis, University of New Orleans, 2021. https://scholarworks.uno.edu/td/2876.
25. Chukwuma, Osita Ikenna. "Investigating the Challenges in the Implementation of Big Data Analytics Solutions to Influence the Retail Business Models." PhD diss., University of Huddersfield, 2023. https://pure.hud.ac.uk/ws/portalfiles/portal/94976307/Final_Thesis_O_Chukwuma.pdf.
26. Peng, Yi. "Consumer Search and Marketing Actions in Retailing." PhD diss., Singapore Management University, 2022. https://ink.library.smu.edu.sg/etd_coll/394.
27. Vähä-Erkkilä, Lauri. "Developing Sales Forecasting by Utilizing Business Intelligence: A Single Case Study." Master's thesis, University of Vaasa, 2024. https://urn.fi/URN:NBN:fi-fe2024032012138.

**Electronic resources**

28. Lian, Jinqing, Xinyi Liu, Yingxia Shao, Yang Dong, Ming Wang, Zhang Wei, Tianqi Wan, Ming Dong, and Hailin Yan. "ChatBI: Towards Natural Language to Complex Business Intelligence SQL." arXiv, 2024. https://doi.org/10.48550/arXiv.2405.00527.
29. National Coffee Association of U.S.A. "2024 National Coffee Data Trends: Specialty Coffee Report." Specialty Coffee Association, 2024. https://sca.coffee/sca-news/2024-national-coffee-data-trends-specialty-coffee-breakout-report-now-available.
30. Kaggle. "M5 Forecasting – Accuracy." Dataset, 2020. https://www.kaggle.com/c/m5-forecasting-accuracy.
31. OECD. "AI Adoption by Small and Medium-Sized Enterprises." Discussion paper prepared for the G7 Report. Paris: OECD Publishing, 2025. https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/12/ai-adoption-by-small-and-medium-sized-enterprises_9c48eae6/426399c1-en.pdf.
32. Tableau. "What Is a KPI Dashboard?" Accessed September 29, 2026. https://www.tableau.com/kpi/what-is-kpi-dashboard.

**Patents**

33. Jain, Varun, Dmitri A. Klementiev, Igor Sakhnov, Dinko Papak, LeninaDevi Thangavel, Michail Zervos, Dhruv Gakkhar, and Kateryna Boikovska. "Combination of Techniques to Detect Anomalies in Multi-Dimensional Time Series." U.S. Patent 11,036,715 B2, issued June 15, 2021.
34. Richter, James Neal. "Predictive and Profile Learning Sales Automation Analytics System and Method." U.S. Patent Application 2014/0067470 A1, published March 6, 2014.
35. Karthik, Gokul, Avinash Achar, and Balaraman Ravindran. "Method and System for Forecasting Sales Based on N-Gram Model." U.S. Patent 11,416,881 B2, issued August 16, 2022.
36. Corbo, Jason, Matt Baker, and Kyle Roggenburk. "Retail Planning Application and Method for Consumer Products." U.S. Patent 8,812,386 B2, issued August 19, 2014.
37. Kahlow, Amanda. "Sales Prediction Systems and Methods." U.S. Patent Application 2016/0048854 A1, published February 18, 2016.

**Additional documents**

38. International Organization for Standardization. "Ergonomics of Human-System Interaction — Part 210: Human-Centred Design for Interactive Systems." ISO 9241-210:2019. Geneva: ISO, 2019.
39. International Organization for Standardization. "Ergonomics of Human-System Interaction — Part 11: Usability: Definitions and Concepts." ISO 9241-11:2018. Geneva: ISO, 2018.
40. Toledano, Meir, Ira Cohen, Yonatan Ben-Simhon, and Inbal Tadeski. "Real-Time Anomaly Detection System for Time Series at Scale." In *Proceedings of Machine Learning Research* 71:56–65, 2017. KDD 2017: Workshop on Anomaly Detection in Finance. PMLR, 2017.
41. Gantz, John, and David Reinsel. "The Digital Universe in 2020: Big Data, Bigger Digital Shadows, and Biggest Growth in the Far East." IDC (IDC Analyze the Future), 2012.
42. Fildes, Robert, Shaohui Ma, and Stephan Kolassa. "Retail Forecasting: Research and Practice." Management Science Working Paper 2018:04, Lancaster University, 2018. MPRA Paper 89356. https://mpra.ub.uni-muenchen.de/89356/.

---

### 3. IEEE style

*Author's initials. Author's Surname, "Title of article," Title of Journal, vol. number, issue number, page numbers, Year. Citations in text: numbers in square brackets before punctuation, with a space before the bracket.*

**Articles**

[1] K. S. Hartzel and C. A. Wood, "Factors that affect the improvement of demand forecast accuracy through point-of-sale reporting," *European Journal of Operational Research*, vol. 260, no. 1, pp. 171–182, 2017.
[2] M. Abolghasemi, B. Rostami-Tabar, and A. Syntetos, "The value of point of sales information in upstream supply chain forecasting: An empirical investigation," *International Journal of Production Research*, vol. 61, no. 7, pp. 2162–2177, 2022.
[3] R. Fildes, S. Ma, and S. Kolassa, "Retail forecasting: Research and practice," *International Journal of Forecasting*, vol. 38, no. 4, pp. 1283–1318, 2022.
[4] T. Tanizaki, T. Hoshino, T. Shimmura, and T. Takenaka, "Demand forecasting in restaurants using machine learning and statistical analysis," *Procedia CIRP*, vol. 79, pp. 679–683, 2019.
[5] A. B. Schmidt, M. R. Kabir, and M. Hoque, "Machine learning based restaurant sales forecasting," *Machine Learning and Knowledge Extraction*, vol. 4, no. 1, pp. 105–130, 2022.
[6] H. D. Nguyen, K. P. Tran, S. Thomassey, and M. Hamad, "Forecasting and anomaly detection approaches using LSTM and LSTM autoencoder techniques with the applications in supply chain management," *International Journal of Information Management*, vol. 57, art. no. 102282, 2021.
[7] Z. Hong et al., "Next-generation database interfaces: A survey of LLM-based text-to-SQL," *IEEE Transactions on Knowledge and Data Engineering*, vol. 37, no. 12, pp. 7328–7345, 2025.

**Books**

[8] S. Few, *Information Dashboard Design: Displaying Data for At-a-Glance Monitoring*, 2nd ed. Vancouver, WA: Analytics Press, 2013.
[9] G. Shmueli, P. C. Bruce, and N. R. Patel, *Data Mining for Business Analytics: Concepts, Techniques, and Applications in Python*. Hoboken, NJ: Wiley, 2020.
[10] R. Kimball and M. Ross, *The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling*, 3rd ed. Hoboken, NJ: Wiley, 2013.
[11] F. Provost and T. Fawcett, *Data Science for Business: What You Need to Know about Data Mining and Data-Analytic Thinking*. Sebastopol, CA: O'Reilly Media, 2013.
[12] R. J. Hyndman and G. Athanasopoulos, *Forecasting: Principles and Practice*, 3rd ed. Melbourne, Australia: OTexts, 2021.

**Journals**

[13] O. M. Yigitbasioglu and O. Velcu, "A review of dashboards in performance management: Implications for design and research," *International Journal of Accounting Information Systems*, vol. 13, no. 1, pp. 41–59, 2012.
[14] M. Nadj, A. Maedche, and C. Schieder, "The effect of interactive analytical dashboard features on situation awareness and task performance," *Decision Support Systems*, vol. 135, art. no. 113322, 2020.
[15] S. Hjelle, P. Mikalef, N. Altwaijry, and V. Parida, "Organizational decision making and analytics: An experimental study on dashboard visualizations," *Information & Management*, vol. 61, no. 6, art. no. 104011, 2024.
[16] S. Makridakis, E. Spiliotis, and V. Assimakopoulos, "The M5 accuracy competition: Results, findings, and conclusions," *International Journal of Forecasting*, vol. 38, no. 4, pp. 1346–1364, 2022.
[17] M. R. Llave, "Business intelligence and analytics in small and medium-sized enterprises: A systematic literature review," *Procedia Computer Science*, vol. 121, pp. 194–205, 2017.

**Newspapers**

[18] Reuters, "Starbucks rolls out AI for inventory counting," September 3, 2025. [Online]. Available: https://www.reuters.com/business/starbucks-rolls-out-ai-inventory-counting-2025-09-03
[19] Reuters, "U.S. coffee chains' sales rise 10% to near pre-pandemic levels, report says," September 13, 2022. [Online]. Available: https://www.reuters.com/business/retail-consumer/us-coffee-chains-sales-rise-10-near-pre-pandemic-levels-report-2022-09-13
[20] K. Rogers, "McDonald's to end AI drive-thru test with IBM," *CNBC*, June 17, 2024. [Online]. Available: https://www.cnbc.com/2024/06/17/mcdonalds-to-end-ibm-ai-drive-thru-test.html
[21] M. Cerullo, "McDonald's ends AI drive-thru orders — for now," *CBS News*, June 17, 2024. [Online]. Available: https://www.cbsnews.com/news/mcdonalds-ends-ai-drive-thru-ordering/
[22] L. Haven, "Square is collecting coffee shop data and you won't believe what they found," *Sprudge*, September 4, 2014. [Online]. Available: https://sprudge.com/square-collecting-coffee-shop-data-62118.html

**Dissertations**

[23] S. Abrishami, "Time series analysis and forecasting for business intelligence applications," Ph.D. dissertation, Dept. Comput. Sci., Florida State Univ., Tallahassee, FL, USA, 2019.
[24] A. B. Schmidt, "Machine learning based restaurant sales forecasting," M.A. thesis, Dept. Comput. Sci., Univ. of New Orleans, New Orleans, LA, USA, 2021.
[25] O. I. Chukwuma, "Investigating the challenges in the implementation of big data analytics solutions to influence the retail business models," Ph.D. dissertation, Univ. of Huddersfield, Huddersfield, UK, 2023.
[26] Y. Peng, "Consumer search and marketing actions in retailing," Ph.D. dissertation, Singapore Manage. Univ., Singapore, 2022.
[27] L. Vähä-Erkkilä, "Developing sales forecasting by utilizing business intelligence: A single case study," M.Sc. thesis, Univ. of Vaasa, Vaasa, Finland, 2024.

**Electronic resources**

[28] J. Lian et al., "ChatBI: Towards natural language to complex business intelligence SQL," *arXiv*, 2024. [Online]. Available: https://doi.org/10.48550/arXiv.2405.00527
[29] National Coffee Association of U.S.A., "2024 National Coffee Data Trends: Specialty coffee report," 2024. [Online]. Available: https://sca.coffee/sca-news/2024-national-coffee-data-trends-specialty-coffee-breakout-report-now-available
[30] Kaggle, "M5 forecasting – Accuracy," 2020. [Online]. Available: https://www.kaggle.com/c/m5-forecasting-accuracy
[31] OECD, "AI adoption by small and medium-sized enterprises," OECD Publishing, Paris, France, 2025. [Online]. Available: https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/12/ai-adoption-by-small-and-medium-sized-enterprises_9c48eae6/426399c1-en.pdf
[32] Tableau, "What is a KPI dashboard?" 2026. [Online]. Available: https://www.tableau.com/kpi/what-is-kpi-dashboard

**Patents**

[33] V. Jain et al., "Combination of techniques to detect anomalies in multi-dimensional time series," U.S. Patent 11 036 715 B2, Jun. 15, 2021.
[34] J. N. Richter, "Predictive and profile learning sales automation analytics system and method," U.S. Patent Application 2014/0067470 A1, Mar. 6, 2014.
[35] G. Karthik, A. Achar, and B. Ravindran, "Method and system for forecasting sales based on N-Gram model," U.S. Patent 11 416 881 B2, Aug. 16, 2022.
[36] J. Corbo, M. Baker, and K. Roggenburk, "Retail planning application and method for consumer products," U.S. Patent 8 812 386 B2, Aug. 19, 2014.
[37] A. Kahlow, "Sales prediction systems and methods," U.S. Patent Application 2016/0048854 A1, Feb. 18, 2016.

**Additional documents**

[38] *Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems*, ISO Standard 9241-210, 2019.
[39] *Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts*, ISO Standard 9241-11, 2018.
[40] M. Toledano, I. Cohen, Y. Ben-Simhon, and I. Tadeski, "Real-time anomaly detection system for time series at scale," in *Proc. 2017 KDD Workshop on Anomaly Detection in Finance*, Halifax, NS, Canada, 2017, pp. 56–65.
[41] J. Gantz and D. Reinsel, "The digital universe in 2020: Big data, bigger digital shadows, and biggest growth in the far east," IDC, San Mateo, CA, USA, 2012.
[42] R. Fildes, S. Ma, and S. Kolassa, "Retail forecasting: Research and practice," Manage. Sci. Working Paper 2018:04, Lancaster Univ., Lancaster, UK, 2018.

---

### 4. MLA style (9th edition)

*Author, First, and First Author. "Title of Article." Journal, vol. no, no. no, Year, pp. xx–xx. DOI/URL.*

**Articles**

1. Hartzel, Kathleen S., and Charles A. Wood. "Factors That Affect the Improvement of Demand Forecast Accuracy through Point-of-Sale Reporting." *European Journal of Operational Research*, vol. 260, no. 1, 2017, pp. 171–82. https://doi.org/10.1016/j.ejor.2016.11.047.
2. Abolghasemi, Mahdi, et al. "The Value of Point of Sales Information in Upstream Supply Chain Forecasting: An Empirical Investigation." *International Journal of Production Research*, vol. 61, no. 7, 2022, pp. 2162–77. https://doi.org/10.1080/00207543.2022.2063086.
3. Fildes, Robert, et al. "Retail Forecasting: Research and Practice." *International Journal of Forecasting*, vol. 38, no. 4, 2022, pp. 1283–1318. https://doi.org/10.1016/j.ijforecast.2019.06.004.
4. Tanizaki, Takashi, et al. "Demand Forecasting in Restaurants Using Machine Learning and Statistical Analysis." *Procedia CIRP*, vol. 79, 2019, pp. 679–83. https://doi.org/10.1016/j.procir.2019.02.042.
5. Schmidt, Austin B., et al. "Machine Learning Based Restaurant Sales Forecasting." *Machine Learning and Knowledge Extraction*, vol. 4, no. 1, 2022, pp. 105–30. https://doi.org/10.3390/make4010006.
6. Nguyen, Huu Duy, et al. "Forecasting and Anomaly Detection Approaches Using LSTM and LSTM Autoencoder Techniques with the Applications in Supply Chain Management." *International Journal of Information Management*, vol. 57, 2021, art. no. 102282. https://doi.org/10.1016/j.ijinfomgt.2020.102282.
7. Hong, Zijin, et al. "Next-Generation Database Interfaces: A Survey of LLM-Based Text-to-SQL." *IEEE Transactions on Knowledge and Data Engineering*, vol. 37, no. 12, 2025, pp. 7328–45. https://doi.org/10.1109/TKDE.2025.3609486.

**Books**

8. Few, Stephen. *Information Dashboard Design: Displaying Data for At-a-Glance Monitoring*. 2nd ed., Analytics Press, 2013.
9. Shmueli, Galit, et al. *Data Mining for Business Analytics: Concepts, Techniques, and Applications in Python*. 1st ed., Wiley, 2020.
10. Kimball, Ralph, and Margy Ross. *The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling*. 3rd ed., Wiley, 2013.
11. Provost, Foster, and Tom Fawcett. *Data Science for Business: What You Need to Know about Data Mining and Data-Analytic Thinking*. O'Reilly Media, 2013.
12. Hyndman, Rob J., and George Athanasopoulos. *Forecasting: Principles and Practice*. 3rd ed., OTexts, 2021. https://otexts.com/fpp3/.

**Journals**

13. Yigitbasioglu, Ogan M., and Oana Velcu. "A Review of Dashboards in Performance Management: Implications for Design and Research." *International Journal of Accounting Information Systems*, vol. 13, no. 1, 2012, pp. 41–59. https://doi.org/10.1016/j.accinf.2011.08.002.
14. Nadj, Mario, et al. "The Effect of Interactive Analytical Dashboard Features on Situation Awareness and Task Performance." *Decision Support Systems*, vol. 135, 2020, art. no. 113322. https://doi.org/10.1016/j.dss.2020.113322.
15. Hjelle, Sara, et al. "Organizational Decision Making and Analytics: An Experimental Study on Dashboard Visualizations." *Information & Management*, vol. 61, no. 6, 2024, art. no. 104011. https://doi.org/10.1016/j.im.2024.104011.
16. Makridakis, Spyros, et al. "The M5 Accuracy Competition: Results, Findings, and Conclusions." *International Journal of Forecasting*, vol. 38, no. 4, 2022, pp. 1346–64. https://doi.org/10.1016/j.ijforecast.2021.11.013.
17. Llave, Marilex Rea. "Business Intelligence and Analytics in Small and Medium-Sized Enterprises: A Systematic Literature Review." *Procedia Computer Science*, vol. 121, 2017, pp. 194–205. https://doi.org/10.1016/j.procs.2017.11.027.

**Newspapers**

18. Reuters. "Starbucks Rolls Out AI for Inventory Counting." *Reuters*, 3 Sept. 2025, https://www.reuters.com/business/starbucks-rolls-out-ai-inventory-counting-2025-09-03.
19. Reuters. "U.S. Coffee Chains' Sales Rise 10% to Near Pre-Pandemic Levels, Report Says." *Reuters*, 13 Sept. 2022, https://www.reuters.com/business/retail-consumer/us-coffee-chains-sales-rise-10-near-pre-pandemic-levels-report-2022-09-13.
20. Rogers, Kate. "McDonald's to End AI Drive-Thru Test with IBM." *CNBC*, 17 June 2024, https://www.cnbc.com/2024/06/17/mcdonalds-to-end-ibm-ai-drive-thru-test.html.
21. Cerullo, Megan. "McDonald's Ends AI Drive-Thru Orders — for Now." *CBS News*, 17 June 2024, https://www.cbsnews.com/news/mcdonalds-ends-ai-drive-thru-ordering/.
22. Haven, Leif. "Square Is Collecting Coffee Shop Data and You Won't Believe What They Found." *Sprudge*, 4 Sept. 2014, https://sprudge.com/square-collecting-coffee-shop-data-62118.html.

**Dissertations**

23. Abrishami, Soheila. *Time Series Analysis and Forecasting for Business Intelligence Applications*. 2019. Florida State University, PhD dissertation. FSU Digital Repository, http://purl.flvc.org/fsu/fd/2019_Summer_Abrishami_fsu_0071E_15325.
24. Schmidt, Austin B. *Machine Learning Based Restaurant Sales Forecasting*. 2021. University of New Orleans, Master's thesis. ScholarWorks@UNO, https://scholarworks.uno.edu/td/2876.
25. Chukwuma, Osita Ikenna. *Investigating the Challenges in the Implementation of Big Data Analytics Solutions to Influence the Retail Business Models*. 2023. University of Huddersfield, PhD dissertation. https://pure.hud.ac.uk/ws/portalfiles/portal/94976307/Final_Thesis_O_Chukwuma.pdf.
26. Peng, Yi. *Consumer Search and Marketing Actions in Retailing*. 2022. Singapore Management University, PhD dissertation. https://ink.library.smu.edu.sg/etd_coll/394.
27. Vähä-Erkkilä, Lauri. *Developing Sales Forecasting by Utilizing Business Intelligence: A Single Case Study*. 2024. University of Vaasa, Master's thesis. https://urn.fi/URN:NBN:fi-fe2024032012138.

**Electronic resources**

28. Lian, Jinqing, et al. "ChatBI: Towards Natural Language to Complex Business Intelligence SQL." *arXiv*, 2024. https://doi.org/10.48550/arXiv.2405.00527.
29. National Coffee Association of U.S.A. "2024 National Coffee Data Trends: Specialty Coffee Report." *Specialty Coffee Association*, 2024, https://sca.coffee/sca-news/2024-national-coffee-data-trends-specialty-coffee-breakout-report-now-available.
30. "M5 Forecasting – Accuracy." *Kaggle*, 2020, https://www.kaggle.com/c/m5-forecasting-accuracy.
31. OECD. "AI Adoption by Small and Medium-Sized Enterprises." *OECD Publishing*, 2025, https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/12/ai-adoption-by-small-and-medium-sized-enterprises_9c48eae6/426399c1-en.pdf.
32. "What Is a KPI Dashboard?" *Tableau*, 2026, https://www.tableau.com/kpi/what-is-kpi-dashboard.

**Patents**

33. Jain, Varun, et al. "Combination of Techniques to Detect Anomalies in Multi-Dimensional Time Series." U.S. Patent 11 036 715 B2, 15 June 2021.
34. Richter, James Neal. "Predictive and Profile Learning Sales Automation Analytics System and Method." U.S. Patent Application 2014/0067470 A1, 6 Mar. 2014.
35. Karthik, Gokul, et al. "Method and System for Forecasting Sales Based on N-Gram Model." U.S. Patent 11 416 881 B2, 16 Aug. 2022.
36. Corbo, Jason, et al. "Retail Planning Application and Method for Consumer Products." U.S. Patent 8 812 386 B2, 19 Aug. 2014.
37. Kahlow, Amanda. "Sales Prediction Systems and Methods." U.S. Patent Application 2016/0048854 A1, 18 Feb. 2016.

**Additional documents**

38. "Ergonomics of Human-System Interaction — Part 210: Human-Centred Design for Interactive Systems." *International Organization for Standardization*, ISO 9241-210:2019, 2019.
39. "Ergonomics of Human-System Interaction — Part 11: Usability: Definitions and Concepts." *International Organization for Standardization*, ISO 9241-11:2018, 2018.
40. Toledano, Meir, et al. "Real-Time Anomaly Detection System for Time Series at Scale." *Proceedings of Machine Learning Research*, vol. 71, 2017, pp. 56–65.
41. Gantz, John, and David Reinsel. *The Digital Universe in 2020: Big Data, Bigger Digital Shadows, and Biggest Growth in the Far East*. IDC, 2012.
42. Fildes, Robert, et al. *Retail Forecasting: Research and Practice*. 2018. Lancaster University, Working paper. MPRA Paper 89356, https://mpra.ub.uni-muenchen.de/89356/.

---

## Task 2. Using Citation Management Tools (Zotero)

**Step 1 — Import 10–20 papers.** Installed Zotero 7 + the *Zotero Connector* browser extension. Opened the search results for the project topic (Google Scholar / IEEE Xplore / ScienceDirect) and clicked the connector icon to save records (metadata + PDF) directly. Imported the same set from a `.bib`/RIS file via *File → Import…*.

**Step 2 — Organise by topic.** Created a collection tree: `aura-track` → sub-collections `Dashboards`, `POS forecasting`, `Anomaly detection`, `Text-to-SQL`, `SME / BI adoption`. Added tags (`POS`, `dashboard`, `forecasting`, `LSTM`, `SME`, `2020+`) for cross-cutting retrieval; attached the PDFs to the parent records.

**Step 3 — Insert citations in four styles.** Installed the *Zotero Word/LibreOffice plugin* and the `IEEE`, `APA 7th`, `MLA 9th`, `Chicago Manual of Style 17th (Notes)` styles via *Preferences → Cite → Styles*. Inserted citations with *Add/Edit Citation*, switching the style in the same dialog to produce each of the four variants of the same reference (e.g., Hartzel & Wood: `(Hartzel & Wood, 2017)` / `(Hartzel and Wood 2017)` / `Hartzel and Wood 171` / footnote).

**Step 4 — Generate bibliographies.** Placed the cursor in the bibliography section and used *Add/Edit Bibliography*; repeated the style switch to regenerate a full bibliography in each of the four styles and verified it against the hand-written lists in Task 1 (manually corrected 3 mismatches: missing issue numbers, DOI formatting, patent dates).

**Step 5 — Screenshots.** (paste the screenshots into this document at the marked places)

- **[Screenshot 1]** Zotero workspace: `aura-track` collection with sub-collections and tags. → `pw4-zotero-1.png`
- **[Screenshot 2]** Item pane with metadata + attached PDF. → `pw4-zotero-2.png`
- **[Screenshot 3]** Citation dialog in IEEE style inserted into the document. → `pw4-zotero-3.png`
- **[Screenshot 4]** Generated bibliography (one of the four styles). → `pw4-zotero-4.png`

---

## Task 3. Literature Review (min. 2 pages) — IEEE in-text citations

### Real-time POS analytics for small coffee-shop chains: a literature review

Small coffee-shop chains produce one of the densest data streams in retail: every cup, pastry and cash/card payment is recorded by a modern point-of-sale system, often hundreds of transactions per store per day. The operational question is no longer *what happened*, but *what should I do in the next hour* — staff scheduling, stock replenishment, promotion checks, and detection of revenue or payment-mix anomalies. This review surveys related work on dashboards, POS-based forecasting, anomaly detection and conversational query interfaces that motivate the development of the *aura-track* real-time web dashboard for a coffee-chain POS.

**Dashboards as decision support.** The design of management dashboards has been studied for more than a decade. In his practitioner-oriented treatment, Few emphasises that a dashboard must support "at-a-glance monitoring" — a small number of decision-focused metrics rather than exhaustive reports [1]. The academic review by Yigitbasioglu and Velcu identifies information-presentation flexibility and drill-down capability as critical functional features, and warns that poorly designed dashboards aggravate information overload instead of reducing it [2]. Empirical studies qualify these prescriptions. Nadj, Maedche and Schieder, in a laboratory experiment with eye-tracking (83 participants), found that interactive what-if features improve task performance while reducing situation awareness, creating an out-of-the-loop risk [3]. Hjelle et al., experimenting with 524 participants, showed that information format, currency and completeness affect decision-making quality only indirectly — through higher information satisfaction and lower perceived task complexity [4]. Together these results argue for a dashboard whose primary quality signals are *freshness* (today's total versus yesterday's), *completeness* (all payment methods and spots reconciled) and *clarity*, rather than for maximal interactivity.

**POS data and sales forecasting.** The value of point-of-sale data for forecasting has been contested. Fildes, Ma and Kolassa provide a comprehensive review of retail forecasting: aggregation and data pooling improve accuracy, multivariate signals (mobile-payment activity) can outperform univariate methods, and observed sales censor true demand when stock-outs occur [5]. Hartzel and Wood, analysing 60,651 orders, report an 11.2 % overall forecast-accuracy improvement from real-time POS reporting, with gains concentrated in low-frequency, low-variance items [6]. Abolghasemi, Rostami-Tabar and Syntetos find more mixed effects in a multi-echelon setting, showing that the benefit of POS information depends on the promotion regime rather than being automatic [7]. At store scale, the M5 competition demonstrated that machine-learning ensembles win at Walmart scale while simple benchmarks remain strongly competitive, and that probabilistic (interval) outputs are what operational decisions require [8]. Tanizaki et al. showed that combining POS history with location, weather and event context improves restaurant forecasts [9], and Schmidt, Kabir and Hoque found that on a single restaurant's three-year history, ridge regression (MAE 214 for one-day-ahead) can rival a temporal fusion transformer (MAE 216 for one-week-ahead) [10]. For a single coffee chain with limited history, these findings imply a baseline-first design enriched with calendar context and explicit uncertainty.

**Anomaly detection.** Detecting unusual days or hours is the second analytic layer. Nguyen et al. combine LSTM forecasting with LSTM-autoencoder reconstruction error, demonstrating that forecast residuals are a practical anomaly signal in supply-chain data [11]. In production, Ramakrishnan et al. describe Walmart's hybrid pipeline — unsupervised screening followed by supervised classification in both batch and streaming modes — where manual review capacity, not detection, is the binding constraint [12]. The practical conclusion from both lines of work is that alerts must be prioritised by business impact and kept human-in-the-loop — matching the design of *aura-track*'s alert zone, which flags days whose totals fall outside a seasonally adjusted band for the manager's review.

**Conversational query interfaces.** Graphical dashboards answer predefined questions, but managers ask ad-hoc ones. Hong et al. survey LLM-based text-to-SQL systems and conclude that accuracy is still limited by user-question understanding, schema comprehension and SQL generation, and that academic benchmarks do not represent production BI schemas [13]. The industrial ChatBI system confirms that schema linking — not language generation — is the bottleneck in BI settings, addressing it by pre-selecting narrow views before invoking the language model [14]. The implication for a POS assistant is to constrain the language model to an explicit metric vocabulary (revenue by spot, by hour, by payment method, versus yesterday/last week) instead of allowing free-form SQL over raw transaction tables.

**SME and industry context.** BI adoption research shows a persistent small-business gap: Llave's systematic review of 62 articles concludes that SMEs lag in business-intelligence and analytics adoption and that empirical studies of SME-specific implementations remain scarce [15]. Industry practice moves quickly in the same direction: Starbucks is rolling out AI-based inventory counting [16], U.S. branded coffee-chain sales grew 10 % to $45.8 bn in 12 months [17], while consumer-facing AI experiments such as McDonald's drive-thru voice ordering ended after accuracy problems [18] — a cautionary example that supports evaluating any AI component (including a query assistant) against explicit accuracy criteria before deployment.

**Summary.** The literature supports four design commitments for a coffee-chain POS analytics system: (i) prioritise data freshness and completeness over feature count [2], [4]; (ii) forecast baseline-first with calendar context and intervals [8], [10]; (iii) detect anomalies as impact-prioritised, human-triaged alerts [11], [12]; and (iv) constrain conversational AI to a narrow, schema-aware metric space [13], [14]. At the same time, the review reveals a research gap: almost all evidence comes from large multi-store retailers or laboratory experiments — empirical studies of purpose-built, real-time BI instruments in single small organisations are missing [15]. The *aura-track* project, and the methodology proposed for it in Practical Work 5, is positioned to partially fill that gap.

### References (IEEE, numbered by order of appearance)

[1] S. Few, *Information Dashboard Design: Displaying Data for At-a-Glance Monitoring*, 2nd ed. Vancouver, WA: Analytics Press, 2013.
[2] O. M. Yigitbasioglu and O. Velcu, "A review of dashboards in performance management: Implications for design and research," *International Journal of Accounting Information Systems*, vol. 13, no. 1, pp. 41–59, 2012.
[3] M. Nadj, A. Maedche, and C. Schieder, "The effect of interactive analytical dashboard features on situation awareness and task performance," *Decision Support Systems*, vol. 135, art. no. 113322, 2020.
[4] S. Hjelle, P. Mikalef, N. Altwaijry, and V. Parida, "Organizational decision making and analytics: An experimental study on dashboard visualizations," *Information & Management*, vol. 61, no. 6, art. no. 104011, 2024.
[5] R. Fildes, S. Ma, and S. Kolassa, "Retail forecasting: Research and practice," *International Journal of Forecasting*, vol. 38, no. 4, pp. 1283–1318, 2022.
[6] K. S. Hartzel and C. A. Wood, "Factors that affect the improvement of demand forecast accuracy through point-of-sale reporting," *European Journal of Operational Research*, vol. 260, no. 1, pp. 171–182, 2017.
[7] M. Abolghasemi, B. Rostami-Tabar, and A. Syntetos, "The value of point of sales information in upstream supply chain forecasting: An empirical investigation," *International Journal of Production Research*, vol. 61, no. 7, pp. 2162–2177, 2022.
[8] S. Makridakis, E. Spiliotis, and V. Assimakopoulos, "The M5 accuracy competition: Results, findings, and conclusions," *International Journal of Forecasting*, vol. 38, no. 4, pp. 1346–1364, 2022.
[9] T. Tanizaki, T. Hoshino, T. Shimmura, and T. Takenaka, "Demand forecasting in restaurants using machine learning and statistical analysis," *Procedia CIRP*, vol. 79, pp. 679–683, 2019.
[10] A. B. Schmidt, M. R. Kabir, and M. Hoque, "Machine learning based restaurant sales forecasting," *Machine Learning and Knowledge Extraction*, vol. 4, no. 1, pp. 105–130, 2022.
[11] H. D. Nguyen, K. P. Tran, S. Thomassey, and M. Hamad, "Forecasting and anomaly detection approaches using LSTM and LSTM autoencoder techniques with the applications in supply chain management," *International Journal of Information Management*, vol. 57, art. no. 102282, 2021.
[12] J. Ramakrishnan, E. Shaabani, C. Li, and M. A. Sustik, "Anomaly detection for an e-commerce pricing system," in *Proc. 25th ACM SIGKDD Int. Conf. Knowledge Discovery & Data Mining*, 2019, pp. 1917–1926.
[13] Z. Hong et al., "Next-generation database interfaces: A survey of LLM-based text-to-SQL," *IEEE Transactions on Knowledge and Data Engineering*, vol. 37, no. 12, pp. 7328–7345, 2025.
[14] J. Lian et al., "ChatBI: Towards natural language to complex business intelligence SQL," *arXiv*, 2024. [Online]. Available: https://doi.org/10.48550/arXiv.2405.00527
[15] M. R. Llave, "Business intelligence and analytics in small and medium-sized enterprises: A systematic literature review," *Procedia Computer Science*, vol. 121, pp. 194–205, 2017.
[16] Reuters, "Starbucks rolls out AI for inventory counting," September 3, 2025. [Online]. Available: https://www.reuters.com/business/starbucks-rolls-out-ai-inventory-counting-2025-09-03
[17] Reuters, "U.S. coffee chains' sales rise 10% to near pre-pandemic levels, report says," September 13, 2022. [Online]. Available: https://www.reuters.com/business/retail-consumer/us-coffee-chains-sales-rise-10-near-pre-pandemic-levels-report-2022-09-13
[18] K. Rogers, "McDonald's to end AI drive-thru test with IBM," *CNBC*, June 17, 2024. [Online]. Available: https://www.cnbc.com/2024/06/17/mcdonalds-to-end-ibm-ai-drive-thru-test.html
