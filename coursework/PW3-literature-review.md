# Practical Work 3 — Literature Review Techniques

**Topic of the review:** Real-time point-of-sale (POS) data analytics for small coffee-shop chains: dashboards, sales forecasting, anomaly detection, and LLM-based conversational BI (case: the *aura-track* project).

**Working research questions of the project:**

- **RQ1.** How do real-time dashboards built on POS transaction data affect the speed and quality of operational decision-making in small retail (coffee-chain) organisations?
- **RQ2.** Which sales-forecasting and anomaly-detection methods are feasible on limited, single-chain POS transaction histories?
- **RQ3.** How can LLM-based conversational interfaces (natural language → SQL/queries) complement graphical dashboards for non-technical users?

---

## a. Search strategy: databases, queries, citation analysis

### Academic databases used

| Database | Why it was used |
|---|---|
| Google Scholar | Broad discovery + citation counts (citation analysis), "cited by" snowballing |
| Scopus / Web of Science (via Crossref metadata) | High-impact journal filtering, DOI verification |
| ScienceDirect (Elsevier) | EJOR, IJF, IJPR, DSS, IJIM — core forecasting/BI journals |
| IEEE Xplore | IEEE TKDE, IEEE EMR — engineering/CS venues |
| SpringerLink | IJPR (Taylor & Francis/Springer), production research |
| MDPI / Procedia (ScienceDirect open access) | Applied, practice-oriented retail analytics papers |
| ACM Digital Library | KDD conference proceedings (anomaly detection) |
| ResearchGate / arXiv | Preprints, surveys, working papers |
| JSTOR / ProQuest (dissertations) | Theses on BI, forecasting, retail analytics |
| Google Patents | Technology landscape for POS forecasting/anomaly detection |

### Boolean search queries

```
("point-of-sale" OR "POS data" OR "transaction data") AND ("sales forecasting"
OR "demand forecasting") AND ("retail" OR "restaurant" OR "coffee shop")

("business intelligence" OR "dashboard" OR "self-service BI") AND ("real-time"
OR "operational decision making") AND ("retail" OR "small business" OR SME)

("anomaly detection" OR "outlier detection") AND ("sales time series"
OR "retail transactions") AND ("real-time" OR "alerting")

("text-to-SQL" OR "natural language interface" OR "conversational analytics"
OR "ChatBI") AND ("business intelligence" OR "OLAP" OR "data query")

("KPI dashboard" OR "performance dashboard") AND ("decision making quality"
OR "situation awareness" OR "user study")

"retail forecasting" AND (review OR "research and practice")
```

Synonyms and spelling variants were combined with **OR**, concept blocks with **AND**; results were further restricted with Scopus/Google Scholar filters (title/abstract keywords, year ≥ 2017 where possible).

### Citation analysis (key papers, backward/forward snowballing)

- **Fildes, Ma & Kolassa (2022)**, *"Retail forecasting: Research and practice"* (Int. J. Forecasting, ~900+ citations) was used as the entry point: its reference list supplied the foundational forecasting sources (POS vs. order-history forecasting, intermittent demand, demand censoring).
- **Yigitbasioglu & Velcu (2012)** (~900 citations) served as the foundational dashboard-design review; its "cited by" chain led to Nadj et al. (2020) and Hjelle et al. (2024).
- **Makridakis, Spiliotis & Assimakopoulos (2022)** (M5 competition) was found through Fildes et al. (2022) and is the standard benchmark reference for retail forecasting accuracy.
- **Hong et al. (2025)** (LLM text-to-SQL survey, IEEE TKDE) was found via arXiv/IEEE Xplore citation alerts and links the project's LLM-assistant feature to the academic literature.
- References of key papers were scanned for additional sources (e.g., Hartzel & Wood 2017 and Abolghasemi et al. 2022 were both retrieved from the Fildes et al. reference list), and forward citations were checked in Google Scholar to catch recent work (2023–2025).

---

## b. Filtering techniques applied

1. **Date filter — last 5–10 years.** Priority given to 2017–2025 publications. Exceptions kept deliberately as *foundational* works: Yigitbasioglu & Velcu (2012), Provost & Fawcett (2013), Few (2013), Kimball & Ross (2013) — canonical, still-cited sources that define the field.
2. **Scope filter (title/abstract review).** Excluded: agricultural crop forecasting, stock-price prediction, healthcare anomaly detection, pure NLP benchmarks with no database/BI component, marketing-only CRM studies, and papers about POS *hardware/payment terminals* rather than POS *data analytics*.
3. **High-impact venue filter.** Prioritised peer-reviewed journals/conferences: *European Journal of Operational Research*, *International Journal of Forecasting*, *International Journal of Production Research*, *Decision Support Systems*, *Information & Management*, *IEEE TKDE*, *KDD*, *Machine Learning and Knowledge Extraction*. Low-citation predatory/venue-unclear papers (e.g., anonymous blogs, unverified "international journals") were dropped even if topically relevant.
4. **Relevance filter (methodology/results).** Preferred papers that (i) use *real transactional data*, (ii) evaluate quantitatively (MAE/RMSE/accuracy/experiment), (iii) address small or single organisations, (iv) report limitations explicitly.
5. **Source verification.** Every retained source was verified through DOI metadata (Crossref) or the publisher/repository page; links in the matrix point to the DOI or an open-access copy.

**Result of filtering:** from ~120 initial hits → 47 after de-duplication → 30 after title/abstract screening → **15 papers included in the summary matrix** (requirement: ≥10).

---

## c. Summary matrix of key papers

### Table 1 — Design, questions and methodology

| # | Authors / year | Research question | Methodology | Theoretical framework |
|---|---|---|---|---|
| 1 | Hartzel & Wood, 2017 | When does real-time shared POS data improve demand-forecast accuracy vs. order-history forecasts? | Hierarchical linear model + multinomial logit on 60,651 orders (hundreds of items, 25 distribution centres) | Information sharing in supply chains |
| 2 | Abolghasemi, Rostami-Tabar & Syntetos, 2022 | Does sharing POS information improve upstream (multi-echelon) supply-chain forecasts? | Empirical study on aggregated POS data (12 DCs, ~2,000 retailers); forecast-error comparison | Supply-chain information sharing; forecasting |
| 3 | Fildes, Ma & Kolassa, 2022 | What characterises successful retail forecasting in research vs. practice? | Multidisciplinary narrative review of retail forecasting literature | Forecast-value-added; aggregation hierarchies; demand censoring |
| 4 | Makridakis, Spiliotis & Assimakopoulos, 2022 | Which methods are most accurate for retail sales at scale? | M5 international forecasting competition on Walmart data (multiple aggregation levels, thousands of series); statistical accuracy tests | Benchmarks, ML ensembles, hierarchical reconciliation |
| 5 | Tanizaki, Hoshino, Shimmura & Takenaka, 2019 | Can store-specific context (location, weather, events) improve restaurant demand forecasts? | Machine-learning models combining POS history with contextual variables; validated on real store data | Context-aware demand forecasting |
| 6 | Schmidt, Kabir & Hoque, 2022 | Which ML models best forecast restaurant sales across intraday time slots? | 3 years of a local restaurant's sales (2016–2019); ridge regression, RNN, temporal fusion transformer; MAE evaluation | Time-series ML; trend/seasonality decomposition |
| 7 | Nguyen, Tran, Thomassey & Hamad, 2021 | Can one architecture do multivariate sales forecasting *and* anomaly detection? | LSTM and LSTM-autoencoder; residual/threshold-based anomaly detection on supply-chain data | Deep learning time series; reconstruction error |
| 8 | Ramakrishnan, Shaabani, Li & Sustik, 2019 (KDD) | How to detect anomalies in a large retail/pricing system in batch *and* streaming? | Unsupervised + supervised models (autoencoder, GaussianNB, random forest); production deployment at Walmart | Contextual anomaly detection; imbalanced learning |
| 9 | Yigitbasioglu & Velcu, 2012 | Which design features make performance dashboards effective? | Multidisciplinary literature review of dashboard research | Information systems; performance management |
| 10 | Nadj, Maedche & Schieder, 2020 | How do interactive analytical features (what-if) affect situation awareness and task performance? | Laboratory experiment with eye-tracking, 83 participants | Situation-awareness theory; decision support systems |
| 11 | Hjelle, Mikalef, Altwaijry & Parida, 2024 | How do dashboard information-quality attributes influence decision-making quality? | Experiment with mock-up visualisations, 524 participants; mediation analysis (SEM) | Information quality; task complexity |
| 12 | Hong, Yuan, Zhang et al., 2025 | How can LLMs generate accurate SQL for complex user questions? | Survey of LLM-based text-to-SQL: datasets, metrics, methods (ICL, fine-tuning), taxonomy | NL databases; in-context learning |
| 13 | Lian et al., 2024 (ChatBI) | How can natural language be translated into complex BI SQL in production? | Industrial design + evaluation of a multi-round NL2BI system deployed at Baidu | Schema linking via view selection; phased NL2SQL pipeline |
| 14 | Llave, 2017 | What is the state of BI&A research in SMEs? | Systematic literature review of 62 articles | BI&A adoption/implementation frameworks |
| 15 | Pałys & Pałys, 2023 | What are the benefits and challenges of self-service BI (SSBI) implementation? | Systematic literature review (SLR) | Self-service BI; information systems success |

### Table 2 — Key findings, results, limitations, conclusions and relevance

| # | Authors / year | Key findings & main results | Limitations / scope | Conclusions of the paper | Relevance to *aura-track* |
|---|---|---|---|---|---|
| 1 | Hartzel & Wood, 2017 | Real-time POS data gave an **11.2 % overall forecast-accuracy improvement**; gains concentrated in low-frequency, low-variance, moderate-quantity items | Single manufacturer, upstream view, observational data | POS reporting helps, but not equally for every item | Proves POS data has measurable forecast value; item-level heterogeneity matters |
| 2 | Abolghasemi et al., 2022 | Benefits of POS data for upstream forecasting are **mixed** and depend on promotion/activity patterns | Aggregated (DC-level) POS data; multi-echelon context | POS sharing should be adopted selectively, not universally | Warns against assuming POS data always beats simple baselines for a small chain |
| 3 | Fildes et al., 2022 | Aggregation/data pooling improve accuracy; multivariate ML (mobile-payment signals) can beat univariate methods; demand censoring biases naive forecasts; practice lags research | Focused on large retailers; narrative (not meta-analytic) review | Retail forecasting is an organisational process, not only a modelling problem | Frames what a coffee-chain-scale system can and cannot borrow from big-retail research |
| 4 | Makridakis et al., 2022 | ML/ensemble methods won M5, but simple benchmarks remained highly competitive; probabilistic (interval) forecasting needed for operations | Walmart scale; dataset lacks true demand (censored sales) | Humility toward complex models; report accuracy and dispersion | Guides *aura-track*'s forecast feature: baseline-first, intervals over point estimates |
| 5 | Tanizaki et al., 2019 | Combining POS history with **location/weather/events** improved restaurant forecasts over pure statistics | Few stores; short horizon; proprietary data | Store-specific context is essential for real-store forecasting | Justifies adding calendar/weather context to *aura-track* predictions |
| 6 | Schmidt et al., 2022 | Ridge regression best for one-day horizon (MAE 214); temporal fusion transformer best for one week (MAE 216) | Single restaurant; one day-part studied | Simple models are competitive on small POS datasets | Directly applicable: *aura-track* has one chain's limited history |
| 7 | Nguyen et al., 2021 | LSTM autoencoders give both good multivariate forecasts and effective anomaly detection via reconstruction error | Computationally expensive; threshold tuning; needs normal-heavy data | Combined forecast+anomaly pipeline is viable in supply chains | Technical basis for *aura-track*'s "normal vs anomalous day" alerts |
| 8 | Ramakrishnan et al., 2019 | Hybrid unsupervised+supervised pipeline detects high-impact anomalies with high precision in batch and streaming | Pricing domain; heavy label imbalance; manual review capacity limits | Human-in-the-loop triage is part of anomaly detection | Mirrors *aura-track*'s alert workflow (detect → prioritise → review) |
| 9 | Yigitbasioglu & Velcu, 2012 | Critical features: information-presentation flexibility, drill-down, appropriate visualisation, reduced information overload | Pre-mobile, pre-LLM literature; descriptive review | Design must match user role and task | Design principles behind *aura-track*'s drill-down/zone UI |
| 10 | Nadj et al., 2020 | What-if interaction **raises task performance but may reduce situation awareness** ("out-of-the-loop") | Lab experiment, student sample, artificial tasks | Interactive features trade off performance vs. awareness | Cautions for interactive drill-downs: keep users oriented |
| 11 | Hjelle et al., 2024 | Format, currency and completeness of information affect decision quality **indirectly** (via information satisfaction ↓ task complexity) | Mock-up dashboards; generic organisational tasks | Dashboard visualisation quality matters through cognitive mediators | Supports emphasising freshness ("today vs yesterday") and completeness of KPIs |
| 12 | Hong et al., 2025 | Text-to-SQL accuracy still limited by question understanding, schema linking and SQL generation; benchmarks ≠ production | Survey; academic benchmarks vs. real BI schemas | Schema-aware, example-augmented prompting is the direction | Academic backing for the *aura-track* LLM assistant (NL → query) |
| 13 | Lian et al., 2024 (ChatBI) | Schema linking is the bottleneck in NL2BI; view pre-selection + phased prompting handles multi-round BI questions and complex comparison SQL | Industrial setting at Baidu; internal evaluation, no public benchmark | NL2BI needs BI-specific schema reduction, not raw LLM text-to-SQL | Direct pattern for the *aura-track* LLM assistant: narrow metric vocabulary instead of free SQL |
| 14 | Llave, 2017 | SMEs lag in BI&A adoption; research fragmented across adoption, implementation, mobile/cloud BI and benefits | 62 articles; databases/period limited to 2017 | Clear agenda: more empirical SME BI studies | Positions *aura-track* as a rare SME-scale empirical artefact |
| 15 | Pałys & Pałys, 2023 | SSBI broadens data access but implementation faces cultural, skill and quality challenges | SLR depends on selected databases; little quantitative evidence | Benefits real, but enablement/training decisive | *aura-track* must stay self-service for non-analyst users |

---

## d. Research gaps and unresolved issues

**1. Theoretical gaps**
- There is no unified theory of *real-time* dashboard value: dashboard research (rows 9–11) studies design features and cognition, but rarely connects them to measurable business outcomes (e.g., forecast-error reduction, reaction time) in day-to-day retail operations.
- Forecasting research (rows 1–4) explains *when* POS data helps in supply chains, but there is no theory for **organisational-level use of one's own POS stream by a single small firm** — the level at which *aura-track* operates.

**2. Methodological gaps**
- Inconsistent evaluation: forecasting papers report MAE/RMASE on proprietary data (rows 5–6), dashboard papers use lab experiments with students (rows 10–11), anomaly papers use injected anomalies (row 8) — results are hard to compare, and **no study evaluates forecasting, anomaly detection and dashboard interaction jointly**.
- Ground-truth problems: sales data censors true demand (rows 3–4) and labelled anomalies are scarce (rows 7–8), yet few papers quantify this uncertainty for small datasets.

**3. Data-related gaps**
- Evidence comes overwhelmingly from large retailers (Walmart-scale data, multi-DC networks: rows 1–4, 8). Studies on **single small outlets, short history (≤ 3 years), multi-outlet coffee chains** are almost absent (row 6 is the rare exception).
- Hour-of-day, weekday/weekend and payment-method dimensions visible in raw POS feeds (cash vs. card splits) are under-studied in the BI-design literature.

**4. Application-based gaps**
- LLM conversational analytics is surveyed for generic databases (row 12) but **not evaluated on POS/BI schemas** with non-expert users; no work measures its error modes together with a dashboard (the exact *aura-track* combination).
- SME context: adoption barriers are described (rows 14–15) but there is little evidence on how *low-cost, real-time, self-built* tools change decision speed in practice.

**5. Inconsistencies across the literature**
- POS data value: Hartzel & Wood (2017) report clear gains, Abolghasemi et al. (2022) report mixed effects — moderators (promotions, aggregation level) are unresolved.
- Interactivity: Nadj et al. (2020) show performance/awareness trade-offs, Hjelle et al. (2024) show positive indirect effects — the net effect of interactive features remains contested.
- Model complexity: M5 (row 4) and restaurant studies (row 6) show simple models are strong baselines, while deep-learning papers (row 7) claim clear advantages — inconsistent evaluation protocols.

**6. Future research directions**
- Multidisciplinary design: combine situation-awareness-aware dashboards (row 10) with forecast-interval displays (row 4) and anomaly triage (row 8).
- Small-data forecasting benchmarks built from real POS feeds (public datasets such as M5 only partially substitute).
- Evaluation of LLM text-to-SQL accuracy on real POS/BI schemas with non-technical users (row 12 × row 13 × rows 14–15).

---

## e. The literature review itself

### Outline

1. Introduction — scope, relevance, research questions
2. Real-time dashboards as decision-support for retail operations
3. Using POS transaction data for sales forecasting
4. Anomaly detection in retail time series
5. Conversational (LLM-based) interfaces for business data
6. The SME/self-service adoption context
7. Discussion of gaps → 8. Conclusion

### 1. Introduction

Small coffee-shop chains generate dense, high-frequency transaction data through modern point-of-sale (POS) systems, yet most of that data remains descriptive: owners see *what* happened, not *what to do next*. This review synthesises literature at the intersection of (a) real-time business-intelligence dashboards, (b) sales forecasting from POS data, (c) anomaly detection in retail time series, and (d) natural-language ("conversational") database interfaces. The synthesis frames the development of *aura-track*, a real-time web dashboard for a coffee-chain's POS data, and is organised around the three research questions stated above (RQ1–RQ3). Sources were selected through database searches, citation analysis and explicit filtering (Sections a–b), and their findings are summarised in the matrix (Section c).

### 2. Real-time dashboards as decision support (RQ1)

Dashboards are expected to reduce information overload and amplify cognition, but only when designed for the user's task. The multidisciplinary review by Yigitbasioglu and Velcu (2012) identifies flexibility of information presentation and drill-down capability as critical design features. Recent empirical work qualifies this picture. Nadj, Maedche and Schieder (2020) found in a controlled, eye-tracked experiment that interactive "what-if" features improved task performance while *reducing* situation awareness — an out-of-the-loop risk for operators who click without keeping the overall picture. Hjelle et al. (2024), experimenting with 524 participants, showed that information format, currency and completeness influence decision-making quality indirectly, through higher satisfaction with the available information and lower perceived task complexity. Together these studies suggest that for operational users, **the freshness and completeness of KPIs matters more than the number of interactive widgets** — a direct design argument for *aura-track*'s "today vs. yesterday" totals, day-over-day deltas and period-empty states.

### 3. POS data for sales forecasting (RQ2)

The forecasting literature is deliberately sober about POS data. Fildes, Ma and Kolassa (2022) show that retail forecasting is an organisational process as much as a modelling one: aggregation and data pooling help, multivariate signals (e.g., mobile-payment activity) can beat univariate methods, and stock-outs censor observed sales. Hartzel and Wood (2017) found a **11.2 % accuracy improvement** from real-time POS reporting over order-history forecasts across 60,651 orders — but with strongly item-dependent effects. Abolghasemi, Rostami-Tabar and Syntetos (2022) report more mixed results for upstream multi-echelon forecasting, implying that the value of POS data depends on context rather than being automatic. At the store level, Tanizaki et al. (2019) demonstrated that adding location, weather and event context to POS history improves restaurant forecasts, while Schmidt, Kabir and Hoque (2022) showed that on a single restaurant's three-year history simple ridge regression (MAE 214 for one-day-ahead) can rival a temporal fusion transformer (MAE 216 for one-week-ahead). The M5 competition results (Makridakis, Spiliotis and Assimakopoulos, 2022) reinforce this: machine-learning ensembles won at Walmart scale, yet simple benchmarks stayed competitive, and probabilistic (interval) outputs are what operational decisions actually require. For a single coffee chain with limited history, the implication is clear: **start with strong baselines enriched with calendar context, and expose uncertainty, not just point forecasts.**

### 4. Anomaly detection in retail time series (RQ1, RQ2)

Anomaly detection translates unusual patterns (a sudden revenue drop, a payment-mix shift) into alerts. Nguyen et al. (2021) combine LSTM forecasting with LSTM-autoencoder reconstruction error to detect anomalies in supply-chain data, showing that forecast residuals are a practical anomaly signal. In production settings, Ramakrishnan et al. (2019) describe Walmart's hybrid pipeline — unsupervised screening plus supervised classification (GaussianNB/random forest) — that operates both in batch and streaming, with manual review capacity as the binding constraint. The recurring theme across both is **human-in-the-loop triage**: detection is cheap, investigation is expensive, so prioritisation by business impact is part of the method. This matches *aura-track*'s anomaly-zone workflow (detect → prioritise → visually flag) more closely than a fully automated "AI decides" framing.

### 5. Conversational LLM interfaces for business data (RQ3)

Graphical dashboards answer predefined questions; users increasingly expect to ask arbitrary ones in natural language. Hong et al. (2025) survey LLM-based text-to-SQL systems and show that accuracy is still limited by three problems — user-question understanding, database-schema comprehension and SQL generation — and that academic benchmarks do not represent production BI schemas, where views, hundreds of columns and ambiguous metric names dominate. The industrial system ChatBI (Lian et al., 2024), deployed at Baidu, confirms that schema linking, not language generation, is the bottleneck in BI settings, and addresses it by pre-selecting narrow views before calling the LLM. For *aura-track*, which exposes a curated set of POS metrics to a non-technical manager, these results suggest constraining the assistant to a small, explicit metric vocabulary rather than free-form SQL over the raw schema.

### 6. The SME / self-service adoption context (RQ1)

The systematic review of 62 studies by Llave (2017) concludes that SMEs lag behind large firms in BI adoption and that research remains fragmented across adoption, mobile/cloud BI and benefits. Pałys and Pałys (2023) add that self-service BI broadens access to data but is frequently undermined by skills gaps, inconsistent definitions of KPIs and weak data governance. The gap *aura-track* addresses is therefore not "another BI platform" but a **purpose-built, real-time, low-overhead instrument** for one small organisation — precisely the artefact category whose empirical evidence is missing from the literature.

### 7. Discussion of gaps

The reviewed streams rarely talk to each other. Dashboard experiments evaluate cognitive outcomes on mock-ups, forecasting papers evaluate error metrics on private data, anomaly papers evaluate on injected anomalies, and text-to-SQL papers evaluate on academic benchmarks. No study evaluates the *combined* system that small retailers actually need: real POS feed → forecast + anomaly layer → dashboard → conversational query. There is also a scale mismatch: the strongest evidence comes from multi-store giants (Walmart-scale datasets), while the decision context of a coffee chain (one manager, minutes-long reaction windows, cash/card mix anomalies) is understudied. Finally, the two main claims in the literature — "POS data improves forecasts" and "interactivity improves decisions" — are both contested by careful empirical work, so both must be demonstrated, not assumed, in *aura-track*.

### 8. Conclusion

The literature establishes three things. First, dashboards create value through **freshness, completeness and task-appropriate design**, not feature count. Second, POS-based forecasting is valuable but **context-dependent**: small samples, calendar effects and censored sales mean simple, well-baselined models with uncertainty intervals are the honest starting point. Third, anomaly detection should be **impact-prioritised and human-triaged**, while LLM interfaces must be **schema-constrained** to be reliable. The identified gaps — absence of small-scale evidence, lack of joint evaluation of forecast/anomaly/dashboard/assistant components, and contested claims about interactivity — define the contribution of this project: *aura-track* will serve as an empirical artefact and, in the follow-up research plan (Practical Work 5), its decision-speed and decision-quality effects will be evaluated on real coffee-chain operations. Specifically, the project will (i) compare baseline vs. context-enriched forecasts on the chain's own history, (ii) measure anomaly-alert response behaviour, and (iii) test whether schema-constrained LLM queries raise the share of correct answers by non-technical users — filling the application-based and data-related gaps categorised in Section d.

---

## Reference list (APA 7th)

1. Hartzel, K. S., & Wood, C. A. (2017). Factors that affect the improvement of demand forecast accuracy through point-of-sale reporting. *European Journal of Operational Research*, *260*(1), 171–182. https://doi.org/10.1016/j.ejor.2016.11.047
2. Abolghasemi, M., Rostami-Tabar, B., & Syntetos, A. (2022). The value of point of sales information in upstream supply chain forecasting: An empirical investigation. *International Journal of Production Research*, *61*(7), 2162–2177. https://doi.org/10.1080/00207543.2022.2063086
3. Fildes, R., Ma, S., & Kolassa, S. (2022). Retail forecasting: Research and practice. *International Journal of Forecasting*, *38*(4), 1283–1318. https://doi.org/10.1016/j.ijforecast.2019.06.004
4. Makridakis, S., Spiliotis, E., & Assimakopoulos, V. (2022). The M5 accuracy competition: Results, findings, and conclusions. *International Journal of Forecasting*, *38*(4), 1346–1364. https://doi.org/10.1016/j.ijforecast.2021.11.013
5. Tanizaki, T., Hoshino, T., Shimmura, T., & Takenaka, T. (2019). Demand forecasting in restaurants using machine learning and statistical analysis. *Procedia CIRP*, *79*, 679–683. https://doi.org/10.1016/j.procir.2019.02.042
6. Schmidt, A. B., Kabir, M. R., & Hoque, M. (2022). Machine learning based restaurant sales forecasting. *Machine Learning and Knowledge Extraction*, *4*(1), 105–130. https://doi.org/10.3390/make4010006
7. Nguyen, H. D., Tran, K. P., Thomassey, S., & Hamad, M. (2021). Forecasting and anomaly detection approaches using LSTM and LSTM autoencoder techniques with the applications in supply chain management. *International Journal of Information Management*, *57*, 102282. https://doi.org/10.1016/j.ijinfomgt.2020.102282
8. Ramakrishnan, J., Shaabani, E., Li, C., & Sustik, M. A. (2019). Anomaly detection for an e-commerce pricing system. In *Proceedings of the 25th ACM SIGKDD International Conference on Knowledge Discovery & Data Mining* (pp. 1917–1926). ACM. https://doi.org/10.1145/3292500.3330748
9. Yigitbasioglu, O. M., & Velcu, O. (2012). A review of dashboards in performance management: Implications for design and research. *International Journal of Accounting Information Systems*, *13*(1), 41–59. https://doi.org/10.1016/j.accinf.2011.08.002
10. Nadj, M., Maedche, A., & Schieder, C. (2020). The effect of interactive analytical dashboard features on situation awareness and task performance. *Decision Support Systems*, *135*, 113322. https://doi.org/10.1016/j.dss.2020.113322
11. Hjelle, S., Mikalef, P., Altwaijry, N., & Parida, V. (2024). Organizational decision making and analytics: An experimental study on dashboard visualizations. *Information & Management*, *61*(6), 104011. https://doi.org/10.1016/j.im.2024.104011
12. Hong, Z., Yuan, Z., Zhang, Q., Chen, H., Dong, J., Huang, F., & Huang, X. (2025). Next-generation database interfaces: A survey of LLM-based text-to-SQL. *IEEE Transactions on Knowledge and Data Engineering*, *37*(12), 7328–7345. https://doi.org/10.1109/TKDE.2025.3609486
13. Lian, J., Liu, X., Shao, Y., Dong, Y., Wang, M., Wei, Z., Wan, T., Dong, M., & Yan, H. (2024). ChatBI: Towards natural language to complex business intelligence SQL. *arXiv*. https://doi.org/10.48550/arXiv.2405.00527
14. Llave, M. R. (2017). Business intelligence and analytics in small and medium-sized enterprises: A systematic literature review. *Procedia Computer Science*, *121*, 194–205. https://doi.org/10.1016/j.procs.2017.11.027
15. Pałys, M., & Pałys, A. (2023). Benefits and challenges of self-service business intelligence implementation. *Procedia Computer Science*, *225*, 795–803. https://doi.org/10.1016/j.procs.2023.10.066
