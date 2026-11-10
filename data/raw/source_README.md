---
dataset_info:
  features:
  - name: job_id
    dtype: int64
  - name: category
    dtype: string
  - name: job_title
    dtype: string
  - name: job_description
    dtype: string
  - name: job_skill_set
    dtype: string
  splits:
  - name: train
    num_bytes: 4909515
    num_examples: 1167
  download_size: 2515687
  dataset_size: 4909515
configs:
- config_name: default
  data_files:
  - split: train
    path: data/train-*
---
# Job Skill Set

## Description

The **Job Skill Set Dataset** is designed for use in machine learning projects related to job matching, skill extraction, and natural language processing tasks. The dataset includes detailed information about job roles, descriptions, and associated skill sets, enabling developers and researchers to build and evaluate models for career recommendation systems, resume parsing, and skill inference.

## Dataset Source

This dataset was initially sourced from the Kaggle dataset titled **[LinkedIn Job Postings](https://www.kaggle.com/datasets/arshkon/linkedin-job-postings)** by *Arshkon*. The original job postings data has been enhanced by extracting skill sets using **[RecAI API services](https://recai.tech)**. These APIs are designed for skill parsing, resume analysis, and other recruitment-related tasks.

## Dataset Structure

The dataset contains the following features:

- **job_id**: A unique identifier for each job posting.
- **category**: The category of the job, such as INFORMATION-TECHNOLOGY,BUSINESS-DEVELOPMENT,FINANCE,SALES or HR.
- **job_title**: The title of the job position.
- **job_description**: A detailed text description of the job, including responsibilities and qualifications.
- **job_skill_set**: A list of relevant skills(include hard and soft skills) associated with the job, extracted using RecAI APIs.

## Use Cases

This dataset is particularly useful for the following applications:

- **Skill Extraction**: Identifying and parsing skills from job descriptions.
- **Job-Resume Matching**: Matching job descriptions with potential candidate profiles.
- **Recommendation Systems**: Developing models that recommend jobs or training programs based on required skills.
- **Natural Language Processing**: Experimenting with text-based models in recruitment and career analytics.

## License

Please consult the license information on the original Kaggle dataset page [here](https://www.kaggle.com/datasets/arshkon/linkedin-job-postings).

## Citation

If you use this dataset, please cite it as follows:

```
@dataset{batuhan_mutlu_2024_job_skill_set,
  title={Job Skill Set Dataset},
  author={Batuhan Mutlu},
  year={2024},
  url={https://huggingface.co/datasets/batuhanmtl/job-skill-set},
  note={Skill sets extracted using RecAI APIs}
}
```